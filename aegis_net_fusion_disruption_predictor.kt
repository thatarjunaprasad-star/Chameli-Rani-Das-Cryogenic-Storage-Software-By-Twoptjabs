package com.aegisnet.disruptionpredictor

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.sin
import kotlin.random.Random

val DarkBg = Color(0xFF0B0F19)
val CardBg = Color(0xFF151D30)
val CyberCyan = Color(0xFF00F0FF)
val CyberOrange = Color(0xFFFF9F00)
val CyberRed = Color(0xFFFF2A5F)
val CyberGreen = Color(0xFF00FF87)
val GridGray = Color(0xFF202C45)
val TextMuted = Color(0xFF8A99AD)

enum class TokamakDevice(
    val deviceName: String,
    val location: String,
    val baselineIp: Float, // MA (MegaAmps)
    val baselineBt: Float, // Tesla
    val baselineDensity: Float, // 10^19 m^-3
    val warningLeadTime: Int // Average forecast lead time target in ms
) {
    DIII_D("DIII-D", "General Atomics, USA", 1.5f, 2.1f, 5.0f, 30),
    EAST("EAST", "ASIPP, China", 1.0f, 3.5f, 4.5f, 50),
    JET("JET", "CCFE, United Kingdom", 3.2f, 3.45f, 8.0f, 80)
}

enum class InstabilityType(val displayName: String, val description: String) {
    LOCKED_MODE("Locked Mode (MHD)", "Growing magnetohydrodynamic tearing modes lock to the wall, causing rapid loss of rotation and confinement."),
    DENSITY_LIMIT("Greenwald Density Limit", "Plasma density exceeds critical limits, causing thermal collapse and edge cooling."),
    CURRENT_QUENCH("Vertical Displacement Event", "Loss of vertical position control, driving rapid vertical drift and wall contact.")
}

data class LogEntry(
    val id: Long = System.nanoTime(),
    val plasmaTimeMs: Float, // relative to simulation start
    val message: String,
    val severity: LogSeverity
)

enum class LogSeverity {
    INFO, WARNING, CRITICAL, SUCCESS
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    background = DarkBg,
                    surface = CardBg,
                    primary = CyberCyan,
                    secondary = CyberOrange,
                    error = CyberRed
                )
            ) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = DarkBg
                ) {
                    DisruptionPredictorDashboard()
                }
            }
        }
    }
}

@Composable
fun DisruptionPredictorDashboard() {
    val coroutineScope = rememberCoroutineScope()
    
    // Core states
    var selectedDevice by remember { mutableStateOf(TokamakDevice.DIII_D) }
    var isSimulating by remember { mutableStateOf(true) }
    var activeInstability by remember { mutableStateOf<InstabilityType?>(null) }
    var mitigationModeAuto by remember { mutableStateOf(true) }
    
    // Plasma sensor values
    var plasmaCurrent by remember { mutableStateOf(selectedDevice.baselineIp) }
    var safetyFactor by remember { mutableStateOf(3.2f) } // q95
    var lockedModeAmplitude by remember { mutableStateOf(0.1f) } // Gauss
    var radiatedPowerRatio by remember { mutableStateOf(0.35f) } // Prad / Pheat
    
    // Neural Network Outputs
    var disruptionProbability by remember { mutableStateOf(0.04f) } // 0.0 to 1.0
    var timeToDisruptionMs by remember { mutableStateOf(999f) }
    var inferenceLatencyMs by remember { mutableStateOf(1.24f) }
    
    // Mitigation state
    var mitigationTriggered by remember { mutableStateOf(false) }
    var mitigationTypeTriggered by remember { mutableStateOf<String?>(null) } // "MGI" or "SPI"
    var plasmaStatus by remember { mutableStateOf("STABLE") } // STABLE, INSTABILITY_DETECTED, MITIGATED, DISRUPTED
    
    // Metrics History for Real-time Chart
    val riskHistory = remember { mutableStateListOf<Float>() }
    val intensityHistory = remember { mutableStateListOf<Float>() }
    
    // Event Logs
    val logs = remember { mutableStateListOf<LogEntry>() }
    var plasmaTimeCounter by remember { mutableStateOf(0.0f) }

    // Initialize lists with flat background values
    LaunchedEffect(Unit) {
        for (i in 1..40) {
            riskHistory.add(0.04f)
            intensityHistory.add(0.1f)
        }
        logs.add(LogEntry(plasmaTimeMs = 0.0f, message = "AEGIS-Net Model initialized. Scanning baseline diagnostics...", severity = LogSeverity.INFO))
    }

    // Reset parameters when changing reactors
    LaunchedEffect(selectedDevice) {
        plasmaCurrent = selectedDevice.baselineIp
        safetyFactor = 3.2f
        lockedModeAmplitude = 0.1f
        radiatedPowerRatio = 0.35f
        disruptionProbability = 0.04f
        timeToDisruptionMs = 999f
        mitigationTriggered = false
        mitigationTypeTriggered = null
        plasmaStatus = "STABLE"
        activeInstability = null
        logs.add(LogEntry(
            plasmaTimeMs = plasmaTimeCounter,
            message = "Configured for ${selectedDevice.deviceName} tokamak. Expected warning window: ${selectedDevice.warningLeadTime} ms.",
            severity = LogSeverity.INFO
        ))
    }

    LaunchedEffect(isSimulating, activeInstability, mitigationTriggered, plasmaStatus) {
        while (isSimulating) {
            delay(80) // simulation clock step
            plasmaTimeCounter += 2.0f // each step represents 2 milliseconds of real-time plasma discharge

            // Neural Network inference benchmark fluctuations
            inferenceLatencyMs = Random.nextFloat() * 0.3f + 1.1f

            if (plasmaStatus == "STABLE" && activeInstability == null) {
                // Add minor random noise to stable plasma
                plasmaCurrent = (selectedDevice.baselineIp + (Random.nextFloat() - 0.5f) * 0.04f).coerceAtLeast(0.1f)
                safetyFactor = (3.2f + (Random.nextFloat() - 0.5f) * 0.1f).coerceAtLeast(1.5f)
                lockedModeAmplitude = (0.1f + Random.nextFloat() * 0.15f).coerceAtLeast(0.01f)
                radiatedPowerRatio = (0.35f + Random.nextFloat() * 0.05f).coerceAtLeast(0.1f)
                
                // Low disruption probability under stable conditions
                disruptionProbability = (0.02f + (lockedModeAmplitude * 0.1f)).coerceAtIn(0.0f, 1.0f)
                timeToDisruptionMs = 999f
            } 
            else if (activeInstability != null && plasmaStatus != "MITIGATED" && plasmaStatus != "DISRUPTED") {
                plasmaStatus = "INSTABILITY_DETECTED"
                
                // Rapidly degenerate plasma parameters based on selected anomaly
                when (activeInstability) {
                    InstabilityType.LOCKED_MODE -> {
                        lockedModeAmplitude += (Random.nextFloat() * 0.8f + 0.5f) // Spike magnetic fluctuations
                        safetyFactor -= 0.08f // Safety factor deteriorates
                        disruptionProbability = (disruptionProbability + 0.12f).coerceAtMost(0.99f)
                    }
                    InstabilityType.DENSITY_LIMIT -> {
                        radiatedPowerRatio += 0.11f // Thermal radiation runaway
                        plasmaCurrent -= 0.05f // Squeezing core current
                        disruptionProbability = (disruptionProbability + 0.09f).coerceAtMost(0.99f)
                    }
                    InstabilityType.CURRENT_QUENCH -> {
                        safetyFactor -= 0.18f // Drastic boundary destabilization
                        lockedModeAmplitude += 0.3f
                        disruptionProbability = (disruptionProbability + 0.15f).coerceAtMost(0.99f)
                    }
                }

                // Safety factor bounds
                safetyFactor = safetyFactor.coerceAtLeast(1.1f)
                
                // Deep learning model computes safety time horizon
                if (disruptionProbability > 0.30f) {
                    val targetLead = selectedDevice.warningLeadTime
                    timeToDisruptionMs = (targetLead * (1.1f - disruptionProbability) + Random.nextInt(-4, 4)).coerceAtLeast(3.0f)
                }

                // Log a warning if probability starts climbing
                if (disruptionProbability in 0.40f..0.45f) {
                    logs.add(0, LogEntry(
                        plasmaTimeMs = plasmaTimeCounter,
                        message = "DNN ALERT: Anomalous plasma profiles detected. Disruption risk: ${(disruptionProbability * 100).toInt()}%",
                        severity = LogSeverity.WARNING
                    ))
                }

                // Check for Automated Mitigation triggering
                if (disruptionProbability >= 0.85f && !mitigationTriggered) {
                    if (mitigationModeAuto) {
                        mitigationTriggered = true
                        // SPI is selected for large machines (JET), MGI for others
                        mitigationTypeTriggered = if (selectedDevice == TokamakDevice.JET) "SPI" else "MGI"
                        plasmaStatus = "MITIGATED"
                        
                        logs.add(0, LogEntry(
                            plasmaTimeMs = plasmaTimeCounter,
                            message = "DNN EVENT TRIGGER: Threshold reached (P=${(disruptionProbability * 100).toInt()}%). Fire command issued in ${(inferenceLatencyMs).toString().take(4)}ms.",
                            severity = LogSeverity.CRITICAL
                        ))
                        logs.add(0, LogEntry(
                            plasmaTimeMs = plasmaTimeCounter + 5f,
                            message = "AUTOMATED MITIGATION SUCCESS: ${mitigationTypeTriggered} injected. Thermal energy dissipated safely. Plasma terminated smoothly.",
                            severity = LogSeverity.SUCCESS
                        ))
                    } else {
                        // Manual mitigation mode - model can only warning, wait for user action
                        if (disruptionProbability >= 0.98f) {
                            plasmaStatus = "DISRUPTED"
                            logs.add(0, LogEntry(
                                plasmaTimeMs = plasmaTimeCounter,
                                message = "CRITICAL FAILURE: Plasma Disruption occurred! Violent current quench. Structural walls subjected to immense electromagnetic loads.",
                                severity = LogSeverity.CRITICAL
                            ))
                        }
                    }
                }
            } 
            else if (plasmaStatus == "MITIGATED") {
                // Safely cooling down plasma
                plasmaCurrent = (plasmaCurrent - 0.3f).coerceAtLeast(0.0f)
                lockedModeAmplitude = (lockedModeAmplitude - 0.4f).coerceAtLeast(0.0f)
                safetyFactor = (safetyFactor + 0.4f).coerceAtMost(10.0f)
                disruptionProbability = (disruptionProbability - 0.2f).coerceAtLeast(0.01f)
                timeToDisruptionMs = 999f
                
                if (plasmaCurrent == 0.0f) {
                    isSimulating = false
                    logs.add(0, LogEntry(
                        plasmaTimeMs = plasmaTimeCounter,
                        message = "Reactor idle. Ready for next simulation discharge.",
                        severity = LogSeverity.INFO
                    ))
                }
            }
            else if (plasmaStatus == "DISRUPTED") {
                // Violent collapse
                plasmaCurrent = 0.0f
                lockedModeAmplitude = 12.0f // extreme spike
                radiatedPowerRatio = 5.0f // massive flash
                disruptionProbability = 1.0f
                timeToDisruptionMs = 0f
                isSimulating = false
            }

            // Update rolling lists
            riskHistory.add(disruptionProbability)
            if (riskHistory.size > 40) riskHistory.removeAt(0)

            intensityHistory.add((lockedModeAmplitude / 5.0f).coerceAtMost(1.0f))
            if (intensityHistory.size > 40) intensityHistory.removeAt(0)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // App Header
        DashboardHeader(
            selectedDevice = selectedDevice,
            onDeviceSelected = { selectedDevice = it },
            plasmaStatus = plasmaStatus
        )

        // Main telemetry block (Live Plot + Dynamic Status Meter)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .wrapContentHeight(),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Live Chart (Left Panel / Top in Mobile)
            Box(
                modifier = Modifier
                    .weight(1.5f)
                    .height(300.dp)
            ) {
                LiveTelemetryPlot(
                    riskHistory = riskHistory,
                    intensityHistory = intensityHistory,
                    status = plasmaStatus
                )
            }

            // Neural Network Forecasting Gauge (Right Panel)
            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(300.dp)
            ) {
                NeuralNetworkInferenceGauge(
                    probability = disruptionProbability,
                    leadTime = timeToDisruptionMs,
                    latency = inferenceLatencyMs,
                    status = plasmaStatus
                )
            }
        }

        // Critical Metrics Status Bar
        MetricsGrid(
            plasmaCurrent = plasmaCurrent,
            safetyFactor = safetyFactor,
            lockedMode = lockedModeAmplitude,
            radiatedPower = radiatedPowerRatio,
            device = selectedDevice
        )

        // Operational Control Room
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Controls & Sandbox Trigger
            Box(modifier = Modifier.weight(1.2f)) {
                InstabilitySandbox(
                    activeInstability = activeInstability,
                    onTriggerInstability = {
                        if (plasmaStatus == "STABLE" || plasmaStatus == "MITIGATED" || plasmaStatus == "DISRUPTED") {
                            // Reset state first if needed
                            if (plasmaStatus == "MITIGATED" || plasmaStatus == "DISRUPTED") {
                                plasmaCurrent = selectedDevice.baselineIp
                                safetyFactor = 3.2f
                                lockedModeAmplitude = 0.1f
                                radiatedPowerRatio = 0.35f
                                disruptionProbability = 0.04f
                                timeToDisruptionMs = 999f
                                mitigationTriggered = false
                                mitigationTypeTriggered = null
                                plasmaStatus = "STABLE"
                                isSimulating = true
                            }
                            activeInstability = it
                            logs.add(0, LogEntry(
                                plasmaTimeMs = plasmaTimeCounter,
                                message = "CRITICAL EVENT STIMULATION: Inducing ${it.displayName} anomaly.",
                                severity = LogSeverity.WARNING
                            ))
                        }
                    },
                    mitigationModeAuto = mitigationModeAuto,
                    onToggleMitigationMode = { mitigationModeAuto = it },
                    onManualMitigate = {
                        if ((plasmaStatus == "INSTABILITY_DETECTED" || disruptionProbability > 0.4f) && !mitigationTriggered) {
                            mitigationTriggered = true
                            mitigationTypeTriggered = "SPI (Manual)"
                            plasmaStatus = "MITIGATED"
                            logs.add(0, LogEntry(
                                plasmaTimeMs = plasmaTimeCounter,
                                message = "MANUAL INTERVENTION: Reactor Operator fired Shattered Pellet Injector (SPI)!",
                                severity = LogSeverity.SUCCESS
                            ))
                        }
                    },
                    onResetSimulation = {
                        plasmaCurrent = selectedDevice.baselineIp
                        safetyFactor = 3.2f
                        lockedModeAmplitude = 0.1f
                        radiatedPowerRatio = 0.35f
                        disruptionProbability = 0.04f
                        timeToDisruptionMs = 999f
                        mitigationTriggered = false
                        mitigationTypeTriggered = null
                        plasmaStatus = "STABLE"
                        activeInstability = null
                        isSimulating = true
                        logs.add(0, LogEntry(
                            plasmaTimeMs = plasmaTimeCounter,
                            message = "Simulation parameters reset. Plasma discharge normalized.",
                            severity = LogSeverity.INFO
                        ))
                    },
                    status = plasmaStatus
                )
            }

            // High Frequency Diagnostics Event Log
            Box(modifier = Modifier.weight(1f)) {
                DiagnosticsLogConsole(logs = logs)
            }
        }

        // Educational Theory Segment
        TheoryExplorer()
    }
}

@Composable
fun DashboardHeader(
    selectedDevice: TokamakDevice,
    onDeviceSelected: (TokamakDevice) -> Unit,
    plasmaStatus: String
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = CardBg),
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, GridGray)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(RoundedCornerShape(50))
                            .background(
                                when (plasmaStatus) {
                                    "STABLE" -> CyberGreen
                                    "INSTABILITY_DETECTED" -> CyberOrange
                                    "MITIGATED" -> CyberCyan
                                    else -> CyberRed
                                }
                            )
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "AEGIS-NET // PLASMA CONSOLE",
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                }
                Text(
                    text = "Predictive Deep Learning Disruption Mitigation Network",
                    color = TextMuted,
                    fontSize = 12.sp
                )
            }

            // Device Profile Tabs
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                TokamakDevice.values().forEach { device ->
                    val isSelected = selectedDevice == device
                    OutlinedButton(
                        onClick = { onDeviceSelected(device) },
                        colors = ButtonDefaults.outlinedButtonColors(
                            containerColor = if (isSelected) CyberCyan.copy(alpha = 0.15f) else Color.Transparent,
                            contentColor = if (isSelected) CyberCyan else TextMuted
                        ),
                        border = BorderStroke(
                            width = 1.dp,
                            color = if (isSelected) CyberCyan else GridGray
                        ),
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = device.deviceName,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun LiveTelemetryPlot(
    riskHistory: List<Float>,
    intensityHistory: List<Float>,
    status: String
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = CardBg),
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, GridGray),
        modifier = Modifier.fillMaxSize()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "DIAGNOSTIC TELEMETRY (LIVE)",
                    color = Color.White,
                    fontSize = 13.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
                
                // Legend
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(modifier = Modifier.size(8.dp).background(CyberRed))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Disruption Risk", color = TextMuted, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(modifier = Modifier.size(8.dp).background(CyberOrange))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("MHD Amplitude", color = TextMuted, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Canvas Plotting
            Canvas(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .background(DarkBg.copy(alpha = 0.5f))
            ) {
                val width = size.width
                val height = size.height

                // Draw background grids
                val gridLines = 5
                for (i in 0..gridLines) {
                    val y = height * i / gridLines
                    drawLine(
                        color = GridGray,
                        start = Offset(0f, y),
                        end = Offset(width, y),
                        strokeWidth = 1f
                    )
                }
                
                // Draw vertical grid lines
                val vLines = 8
                for (i in 0..vLines) {
                    val x = width * i / vLines
                    drawLine(
                        color = GridGray,
                        start = Offset(x, 0f),
                        end = Offset(x, height),
                        strokeWidth = 1f
                    )
                }

                // Draw Risk Line (CyberRed)
                if (riskHistory.size > 1) {
                    val path = Path()
                    val dx = width / (riskHistory.size - 1)
                    path.moveTo(0f, height - (riskHistory[0] * height))
                    for (i in 1 until riskHistory.size) {
                        path.lineTo(i * dx, height - (riskHistory[i] * height))
                    }
                    drawPath(
                        path = path,
                        color = CyberRed,
                        style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round)
                    )
                }

                // Draw Instability Line (CyberOrange)
                if (intensityHistory.size > 1) {
                    val path = Path()
                    val dx = width / (intensityHistory.size - 1)
                    path.moveTo(0f, height - (intensityHistory[0] * height))
                    for (i in 1 until intensityHistory.size) {
                        path.lineTo(i * dx, height - (intensityHistory[i] * height))
                    }
                    drawPath(
                        path = path,
                        color = CyberOrange,
                        style = Stroke(
                            width = 2.dp.toPx(),
                            cap = StrokeCap.Round,
                            pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 10f), 0f)
                        )
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Model updating at 500 Hz (2ms increments). Sliding archival window: 80ms.",
                color = TextMuted,
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace
            )
        }
    }
}

@Composable
fun NeuralNetworkInferenceGauge(
    probability: Float,
    leadTime: Float,
    latency: Float,
    status: String
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = CardBg),
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, GridGray),
        modifier = Modifier.fillMaxSize()
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "AI FORECAST HORIZON",
                color = Color.White,
                fontSize = 13.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.fillMaxWidth()
            )

            // Circle Ring gauge
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(130.dp)
                    .padding(8.dp)
            ) {
                // Background track
                Canvas(modifier = Modifier.fillMaxSize()) {
                    drawArc(
                        color = GridGray,
                        startAngle = -220f,
                        sweepAngle = 260f,
                        useCenter = false,
                        style = Stroke(width = 10.dp.toPx(), cap = StrokeCap.Round)
                    )
                }

                // Forecast Arc Fill
                val sweepAngle = 260f * probability
                val arcColor = when {
                    probability > 0.8f -> CyberRed
                    probability > 0.4f -> CyberOrange
                    else -> CyberCyan
                }

                Canvas(modifier = Modifier.fillMaxSize()) {
                    drawArc(
                        color = arcColor,
                        startAngle = -220f,
                        sweepAngle = sweepAngle,
                        useCenter = false,
                        style = Stroke(width = 10.dp.toPx(), cap = StrokeCap.Round)
                    )
                }

                // Central reading
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "${(probability * 100).toInt()}%",
                        color = arcColor,
                        fontSize = 28.sp,
                        fontWeight = FontWeight.ExtraBold,
                        fontFamily = FontFamily.Monospace
                    )
                    Text(
                        text = "RISK INDEX",
                        color = TextMuted,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            // Real-time inference diagnostics
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Warning Time:", color = TextMuted, fontSize = 11.sp)
                    Text(
                        text = if (leadTime > 900) "N/A (Stable)" else "${leadTime.toInt()} ms",
                        color = if (leadTime < 40) CyberRed else CyberGreen,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Inference Latency:", color = TextMuted, fontSize = 11.sp)
                    Text(
                        text = "${latency.toString().take(4)} ms",
                        color = CyberCyan,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("DNN State:", color = TextMuted, fontSize = 11.sp)
                    Text(
                        text = if (probability > 0.8f) "TRIGGERED" else "MONITORING",
                        color = if (probability > 0.8f) CyberRed else CyberCyan,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }
        }
    }
}

@Composable
fun MetricsGrid(
    plasmaCurrent: Float,
    safetyFactor: Float,
    lockedMode: Float,
    radiatedPower: Float,
    device: TokamakDevice
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        val list = listOf(
            MetricItem("Plasma Current (Ip)", "${plasmaCurrent.toString().take(4)} MA", "Baseline: ${device.baselineIp} MA", if (plasmaCurrent < device.baselineIp * 0.7f && plasmaCurrent > 0) CyberOrange else Color.White),
            MetricItem("Safety Factor (q95)", safetyFactor.toString().take(4), "Crit Limit: < 2.0", if (safetyFactor < 2.0f) CyberRed else CyberGreen),
            MetricItem("Locked Mode", "${lockedMode.toString().take(4)} G", "Instab Threshold: > 1.5", if (lockedMode > 1.5f) CyberRed else CyberGreen),
            MetricItem("Rad. Power Ratio", "${(radiatedPower * 100).toInt()}%", "Alarm: > 90%", if (radiatedPower > 0.90f) CyberOrange else CyberCyan)
        )

        list.forEach { metric ->
            Card(
                colors = CardDefaults.cardColors(containerColor = CardBg),
                shape = RoundedCornerShape(8.dp),
                border = BorderStroke(1.dp, GridGray),
                modifier = Modifier.weight(1f)
            ) {
                Column(
                    modifier = Modifier.padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(text = metric.title, color = TextMuted, fontSize = 11.sp)
                    Text(text = metric.value, color = metric.valueColor, fontSize = 18.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                    Text(text = metric.subtitle, color = TextMuted.copy(alpha = 0.7f), fontSize = 10.sp)
                }
            }
        }
    }
}

data class MetricItem(
    val title: String,
    val value: String,
    val subtitle: String,
    val valueColor: Color
)

@Composable
fun InstabilitySandbox(
    activeInstability: InstabilityType?,
    onTriggerInstability: (InstabilityType) -> Unit,
    mitigationModeAuto: Boolean,
    onToggleMitigationMode: (Boolean) -> Unit,
    onManualMitigate: () -> Unit,
    onResetSimulation: () -> Unit,
    status: String
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = CardBg),
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, GridGray),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "OPERATIONAL TESTBED & MITIGATION SANDBOX",
                color = Color.White,
                fontSize = 13.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Inject a thermal/magnetic anomaly to benchmark the automated mitigation triggers.",
                color = TextMuted,
                fontSize = 11.sp,
                modifier = Modifier.padding(bottom = 12.dp)
            )

            // Anomaly triggers
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                InstabilityType.values().forEach { instability ->
                    val isActive = activeInstability == instability
                    Button(
                        onClick = { onTriggerInstability(instability) },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isActive) CyberOrange else GridGray,
                            contentColor = Color.White
                        ),
                        shape = RoundedCornerShape(6.dp),
                        modifier = Modifier.weight(1f),
                        contentPadding = PaddingValues(horizontal = 4.dp, vertical = 8.dp)
                    ) {
                        Text(
                            text = instability.displayName.substringBefore(" ("),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Mitigation Settings
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Automated Mitigation Protocol (AMP)",
                        color = Color.White,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Trigger MGI/SPI valve within 10ms",
                        color = TextMuted,
                        fontSize = 10.sp
                    )
                }
                Switch(
                    checked = mitigationModeAuto,
                    onCheckedChange = onToggleMitigationMode,
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = CyberCyan,
                        checkedTrackColor = CyberCyan.copy(alpha = 0.4f),
                        uncheckedThumbColor = TextMuted,
                        uncheckedTrackColor = GridGray
                    )
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Emergency Override actions
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Emergency Trigger (Manual)
                OutlinedButton(
                    onClick = onManualMitigate,
                    enabled = !mitigationModeAuto && status == "INSTABILITY_DETECTED",
                    border = BorderStroke(1.dp, if (!mitigationModeAuto) CyberRed else GridGray),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = CyberRed,
                        disabledContentColor = TextMuted.copy(alpha = 0.3f)
                    ),
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = "MANUAL VALVE TRIGGER",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                }

                // Reset Reactor state
                Button(
                    onClick = onResetSimulation,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = CyberCyan,
                        contentColor = DarkBg
                    ),
                    shape = RoundedCornerShape(4.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = "RESET REACTOR DISCHARGE",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }
        }
    }
}

@Composable
fun DiagnosticsLogConsole(logs: List<LogEntry>) {
    Card(
        colors = CardDefaults.cardColors(containerColor = CardBg),
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, GridGray),
        modifier = Modifier
            .fillMaxWidth()
            .height(235.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "HIGH-FREQUENCY DIAGNOSTICS LOG",
                color = Color.White,
                fontSize = 13.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 8.dp)
            )

            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .background(DarkBg.copy(alpha = 0.6f))
                    .padding(8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                items(logs, key = { it.id }) { log ->
                    val color = when (log.severity) {
                        LogSeverity.INFO -> TextMuted
                        LogSeverity.WARNING -> CyberOrange
                        LogSeverity.CRITICAL -> CyberRed
                        LogSeverity.SUCCESS -> CyberGreen
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.Top
                    ) {
                        Text(
                            text = "[${log.plasmaTimeMs.toString().take(5)} ms]",
                            color = CyberCyan,
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = log.message,
                            color = color,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            lineHeight = 14.sp
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun TheoryExplorer() {
    Card(
        colors = CardDefaults.cardColors(containerColor = CardBg),
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, GridGray),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "SCIENTIFIC INSIGHT: DEEP NEURAL NETWORKS IN TOKAMAK PHYSICS",
                color = CyberCyan,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                modifier = Modifier.padding(bottom = 12.dp)
            )

            Text(
                text = "Plasma disruptions represent the single greatest challenge in structural survival for commercial Tokamak reactors. At temperatures hotter than the sun's core, an unmitigated termination can release gigajoules of thermal and magnetic energy directly onto the beryllium or tungsten tile walls within microseconds.",
                color = Color.White.copy(alpha = 0.9f),
                fontSize = 13.sp,
                lineHeight = 18.sp
            )

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "1. ARCHIVAL BIG DATA TRAINING",
                        color = CyberOrange,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                    Text(
                        text = "Models are trained across decades of plasma pulses stored in multi-terabyte data archives from active tokamaks such as General Atomics' DIII-D, China's EAST, and Europe's Joint European Torus (JET).",
                        color = TextMuted,
                        fontSize = 11.sp,
                        lineHeight = 15.sp,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "2. LSTM & TRANSFORMER INFERENCE",
                        color = CyberOrange,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                    Text(
                        text = "Using Recurrent Neural Networks (LSTM) or temporal transformers, the AI ingests continuous diagnostics streams to detect microsecond anomalies and locked-mode precursors before they escalate.",
                        color = TextMuted,
                        fontSize = 11.sp,
                        lineHeight = 15.sp,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "3. RAPID MITIGATION INJECTION",
                        color = CyberOrange,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                    Text(
                        text = "Upon prediction, automated FPGA systems trigger Massive Gas Injection (MGI) or Shattered Pellet Injectors (SPI) to radiate heat energy uniformly and avoid high-energy runaway electron beams.",
                        color = TextMuted,
                        fontSize = 11.sp,
                        lineHeight = 15.sp,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }
        }
    }
}