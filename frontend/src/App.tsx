import { useState, useEffect, useCallback } from 'react';
import Web3 from 'web3';
import io from 'socket.io-client';

// Define a TypeScript interface for the Alert data structure
interface LiveLog {
    alertId: string;
    sourceType: string;
    logData: string;
    severity: string;
    isSuspicious: boolean;
    timestamp: number;
}

interface ChainLog {
    alertId: string;
    sourceType: string;
    logHash: string;
    timestamp: number;
    reporter: string;
    isSuspicious: boolean;
    confidence: number;
    modelVersion: string;
}

type unifiedLog = LiveLog | ChainLog;

// --- MINIMAL CONTRACT ABI ---
// This replaces the need for the IDSLogs.json file *for this preview*
// In your local project, replace this with: import IDSLogsContract from './IDSLogs.json';
const IDSLogsContract = {
    abi: [
        {
            "inputs": [],
            "name": "getAlertsCount",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "index",
                    "type": "uint256"
                }
            ],
            "name": "getAlert",
            "outputs": [
                    
                        {
                            "internalType": "string",
                            "name": "alertId",
                            "type": "string"
                        },
                        {
                            "internalType": "string",
                            "name": "sourceType",
                            "type": "string"
                        },
                        {
                            "internalType": "bytes32",
                            "name": "logHash",
                            "type": "bytes32"
                        },
                        {
                            "internalType": "uint256",
                            "name": "timestamp",
                            "type": "uint256"
                        },
                        {
                            "internalType": "address",
                            "name": "reporter",
                            "type": "address"
                        },
                        {
                            "internalType": "bool",
                            "name": "isSuspicious",
                            "type": "bool"
                        },
                        {
                            "internalType": "uint16",
                            "name": "confidence",
                            "type": "uint16"
                        },
                        {
                            "internalType": "string",
                            "name": "modelVersion",
                            "type": "string"
                        }
            ],
            "stateMutability": "view",
            "type": "function"
        }
    ]
};
// --- END MINIMAL ABI ---


const contractAddress = '0xF4206c78Ba9c0f9b4EC738ba8f9CedAEe54A6946'; // PASTE YOUR CONTRACT ADDRESS
const ganachePort = 8545;
//const backendApiUrl = 'http://127.0.0.1:3001/api/log-alert';

// --- Simple Styles ---
// We'll add class names for the animations later
const styles: { [key: string]: React.CSSProperties } = {
    // UPDATED: Main container width to fit layout
    body : { background: '#000'},
    container: { fontFamily: 'Arial, sans-serif', width: '1470px', margin: '20px auto', padding: '20px', backgroundColor: '#000000', color: '#fff' },
    h1: { color: '#240572ff', textAlign: 'center', marginBottom: '30px' }, // Added margin bottom
    h2: { color: '#240572ff', borderBottom: '2px solid #bdc3c7', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }, // Added margin bottom
    // NEW: Main layout container
    mainLayout: { display: 'flex', gap: '30px' },
    // NEW: Form column style
    formColumn: { flex: '1 1 350px', maxWidth: '350px' }, // Flex basis 350px, max width 350px
    // NEW: Logs column style
    logsColumn: { flex: '2 1 600px', minWidth: '400px' }, // Takes up remaining space, min width 400px

    message: { padding: '12px', borderRadius: '4px', marginTop: '10px', textAlign: 'center', fontWeight: 'bold' },
    error: { background: '#e74c3c', color: 'white', border: '1px solid #c0392b' },
    success: { background: '#2ecc71', color: 'white', border: '1px solid #27ae60' },
    logList: { listStyleType: 'none', padding: '0', maxHeight: 'auto', overflowY: 'auto' }, // Added max height and scroll
    logItem: {
        background: '#000',
        border: '1px solid #fff',
        padding: '18px',
        borderRadius: '8px',
        marginBottom: '23px', // Slightly reduced margin
        boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
        transition: 'background-color 0.2s ease-in-out',
        position: 'relative',
        overflow: 'visible'
    },
    logItemHoverSuspicious: { backgroundColor: '#fadbd8', color: '#000' },
    logItemHoverSafe: { backgroundColor: '#d5f5e3', color: '#000' },
    statusText: { fontWeight: 'bold', textTransform: 'uppercase' },
    suspiciousText: { color: '#e74c3c' },
    safeText: { color: '#2ecc71' },
    smallText: { color: '#aaa', fontSize: '0.9em', wordBreak: 'break-all' },
    refreshButton: {
        background: '#95a5a6',
        color: 'white',
        padding: '8px 15px',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        marginLeft: '10px'
    },
    refreshButtonLoading: {
        background: '#bdc3c7',
        cursor: 'not-allowed',
    },
    form: { background: '#222', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }, // Removed margin bottom
    formGroup: { marginBottom: '15px' },
    label: { display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#eee' },
    input: { width: 'calc(100% - 22px)', padding: '10px', border: '1px solid #555', borderRadius: '4px', fontSize: '1rem', backgroundColor: '#444', color: '#fff' },
    textarea: { width: 'calc(100% - 22px)', padding: '10px', border: '1px solid #555', borderRadius: '4px', minHeight: '60px', /* Reduced height */ resize: 'vertical', fontSize: '1rem', backgroundColor: '#444', color: '#fff' },
    button: { background: '#240572ff', color: 'white', padding: '12px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', width: '100%' },
    buttonDisabled: { background: '#bdc3c7', cursor: 'not-allowed' },
    filterSection: { background: '#222', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', marginBottom: '30px' },
    clearButton: { background: '#e74c3c', color: 'white', padding: '8px 15px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', marginTop: '15px', width: '100%' }, 
};
// --- End Styles ---

function App() {
    const [chainLogs, setChainLogs] = useState<ChainLog[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [apiError, setApiError] = useState<string | null>(null);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [liveLogs, setLiveLogs] = useState<any[]>([]);

    useEffect(() => {
        const socket = io('http://localhost:3001');

        socket.on('new-live-log', (data: LiveLog) => {
            setLiveLogs(prev => [data, ...prev]); 
        });

        return () => {socket.disconnect();};
    }, []);

    const allLogs: unifiedLog[] = [...liveLogs, ...chainLogs];

    // --- Re-added State for the Form ---
    /*const [newAlertId, setNewAlertId] = useState('');
    const [newSourceType, setNewSourceType] = useState('');
    const [newLogData, setNewLogData] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [apiSuccess, setApiSuccess] = useState<string | null>(null);*/

    // Filters State
    const [filterStatus, setFilterStatus] = useState<'all' | 'safe' | 'suspicious'>('all');

    
    const fetchAlerts = useCallback(async () => {
        console.log("Fetching alerts...");
        // Keep loading true if it's already true (initial load), otherwise just log refresh
        if (!loading) console.log("Refreshing logs...");
        setLoading(true); // Always set loading true during fetch
        setApiError(null);
        try {
            const web3 = new Web3(`http://127.0.0.1:${ganachePort}`);
            const idsLogsContract = new web3.eth.Contract(
                IDSLogsContract.abi as any,
                contractAddress
            );

            const alertCount = await idsLogsContract.methods.getAlertsCount().call();
            const totalAlerts = Number(alertCount); 
            console.log("Alert count from blockchain:", String(totalAlerts));

            const calls = [];
            for (let i = 0; i < totalAlerts; i++) {
                calls.push(idsLogsContract.methods.getAlert(i).call());
            }

            const results = await Promise.all(calls);

            const fetched: ChainLog[] = results.map((res: any) => ({
                alertId: res[0],
                sourceType: res[1],
                logHash: res[2],
                timestamp: Number(res[3]),
                reporter: res[4],
                isSuspicious: res[5],
                confidence: Number(res[6]),
                modelVersion: res[7],
            }));

            setChainLogs(fetched.reverse());

        } catch (error) {
            console.error('Failed to fetch alerts:', error);
            setApiError('Failed to connect to blockchain or fetch alerts. Is Ganache running?');
        }
        setLoading(false);
    }, [loading]); // Added loading to dependency array

    useEffect(() => {
        fetchAlerts();
    }, [fetchAlerts]);

    const handleRefresh = () => {
        fetchAlerts();
    };

    // --- Re-added Submit Handler ---
    /*const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setApiError(null);
        setApiSuccess(null);

        if (!newAlertId || !newSourceType || !newLogData) {
            setApiError("All fields are required.");
            setIsSubmitting(false);
            return;
        }

        try {
            const response = await fetch(backendApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    alertId: newAlertId,
                    sourceType: newSourceType,
                    logData: newLogData
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'API request failed');
            }

            //setApiSuccess(`Success! Log stored. Prediction: ${result.isSuspicious ? 'Suspicious' : 'Safe'} (Tx: ${result.txHash.substring(0, 10)}...)`);
            setNewAlertId('');
            setNewSourceType('');
            setNewLogData('');
            // Refresh the list after a short delay
            setTimeout(fetchAlerts, 1500); // Give blockchain a moment

        } catch (err: any) {
            console.error("Submit Error:", err);
            if (err.message.includes('Failed to fetch')) {
                setApiError('Error: Cannot connect to backend server. Is it running?');
            } else {
                setApiError(err.message || 'An unknown error occurred.');
            }
        }
        setIsSubmitting(false);
    };*/

    // Filters Logic code
    /*const allLogsFilter = allLogs.filter(alert => {
        // Filter by status
        if(filterStatus === 'safe' && alert.isSuspicious) return false;
        if(filterStatus === 'suspicious' && !alert.isSuspicious) return false;
        return true;
    });*/


    // Handler to clear all filters
    const clearFilters = () => {
        setFilterStatus('all');
    };

    return (
        <div style={styles.container}>

            <h1 style={styles.h1}>Blockchain-Based Intrusion Detection System</h1>

            {/* NEW: Main Layout Div */}
            <div style={styles.mainLayout}>

                {/* --- Form Column --- */}
                <div style={styles.formColumn}>
                    
                    {/* --- Filters Section --- */}
                    <h2 style={{...styles.h2}}>Filter Logs</h2>
                    <div style={styles.filterSection}>
                         <div style={styles.formGroup}>
                            <label htmlFor="filterStatus" style={styles.label}>Status</label>
                            <select
                                id="filterStatus"
                                style={styles.select}
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'safe' | 'suspicious')}
                            >
                                <option value="all">All</option>
                                <option value="safe">Safe Only</option>
                                <option value="suspicious">Suspicious Only</option>
                            </select>
                        </div>
                        <div style={styles.formGroup}>
                            <label htmlFor="filterRequestType" style={styles.label}>Request Type</label>
                             <select
                                id="filterRequestType"
                                style={styles.select}>
                                <option value="all">All</option>
                                <option value="GET">GET</option>
                                <option value="POST">POST</option>
                                <option value="PUT">PUT</option>
                                <option value="DELETE">DELETE</option>
                            </select>
                        </div>
                        {/* <div style={styles.formGroup}>
                            <label htmlFor="filterStatusCode" style={styles.label}>Status Code (contains)</label>
                            <input
                                type="text"
                                id="filterStatusCode"
                                style={styles.input}
                                placeholder="e.g., 404, 500"
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label htmlFor="filterUserAgent" style={styles.label}>User Agent (contains)</label>
                            <input
                                type="text"
                                id="filterUserAgent"
                                style={styles.input}
                                placeholder="e.g., Bot, Firefox"
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label htmlFor="filterLocation" style={styles.label}>Location (contains)</label>
                            <input
                                type="text"
                                id="filterLocation"
                                style={styles.input}
                                placeholder="e.g., USA, China"
                            />
                        </div>
                        */}
                        <button onClick={clearFilters} style={styles.clearButton}>
                            Clear Filters
                        </button>
                    </div>
                    {/* --- End Filters Section --- */}

                </div>
                {/* --- End Form and Filter Column --- */}


                {/* --- Logs Column --- */}
                <div style={styles.logsColumn}>
                    {/* Display blockchain connection error if it occurs */}
                    {apiError && <div style={{ ...styles.message, ...styles.error, marginBottom: '20px' }}>{apiError}</div>}

                    <h2 style={styles.h2}>
                        Live Traffic and Immutable Logs ({allLogs.length} total)
                        <button
                            onClick={handleRefresh}
                            style={loading ? {...styles.refreshButton, ...styles.refreshButtonLoading} : styles.refreshButton}
                            disabled={loading}
                        >
                            {loading ? 'Refreshing...' : 'Refresh'}
                        </button>
                    </h2>

                    {loading && allLogs.length === 0 ? (
                        <div>Loading alerts...</div>
                    ) : allLogs.length === 0 ? (
                        <p>No Network activity detected at..!</p>
                    ) : (
                        <ul style={styles.logList}>
                            {allLogs.map((alert, index) => {
                                const isHovered = hoveredIndex === index;
                                const isLive = "logData" in alert;
                                const isSuspicious = alert.isSuspicious === true;
                                const baseBorderStyle = isSuspicious ? styles.logSuspiciousBorder : styles.logSafeBorder;
                                const hoverStyle = isHovered
                                    ? (isSuspicious ? styles.logItemHoverSuspicious : styles.logItemHoverSafe)
                                    : {};
                                const animationClass = isSuspicious ? 'electric-border-red' : 'electric-border-green';

                                return (
                                    <li
                                        key={alert.alertId || index}
                                        className={animationClass} // Apply the animation class
                                        style={{
                                            ...styles.logItem,
                                            ...baseBorderStyle,
                                            ...hoverStyle
                                        }}
                                        onMouseEnter={() => setHoveredIndex(index)}
                                        onMouseLeave={() => setHoveredIndex(null)}
                                    >
                                        
                                        <li
                                            key={alert.alertId}
                                            className={animationClass}
                                            style={{
                                                ...styles.logItem,
                                                ...baseBorderStyle,
                                                ...hoverStyle
                                            }}
                                            onMouseEnter={() => setHoveredIndex(index)}
                                            onMouseLeave={() => setHoveredIndex(null)}
                                            >
                                            {/* HEADER ROW */}
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <div>
                                                    <strong>ID:</strong> {alert.alertId}
                                                </div>

                                                <span style={{
                                                    fontSize: '0.7em',
                                                    background: isLive ? '#240572ff' : '#27ae60',
                                                    borderRadius: '5px'
                                                    }}>
                                                    {isLive ? "📡 LIVE STREAM" : "🔗 BLOCKCHAIN"}
                                                </span>
                                            </div>
                                            {/* BODY */}
                                            <strong>Source:</strong> {alert.sourceType}<br />
                                            <strong>Data:</strong> {isLive ? alert.logData : alert.logHash}<br />

                                            <strong>Status:</strong>{" "}
                                            {isSuspicious ? (
                                                <span style={{ ...styles.statusText, ...styles.suspiciousText }}>
                                                🔴 SUSPICIOUS
                                                </span>
                                            ) : (
                                                <span style={{ ...styles.statusText, ...styles.safeText }}>
                                                🟢 SAFE
                                                </span>
                                            )}
                                            <br />

                                            {!isLive && (
                                                <>
                                                    <strong>Confidence:</strong> {alert.confidence}%<br />
                                                    <strong>Model:</strong> {alert.modelVersion}<br />
                                                    <small style={styles.smallText}>
                                                        <strong>Reporter:</strong> {alert.reporter}
                                                    </small><br />
                                                </>
                                            )}

                                            <strong>Timestamp:</strong>{" "}
                                            {new Date(alert.timestamp * 1000).toLocaleString()}
                                            </li>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
                {/* --- End Logs Column --- */}

            </div> {/* End Main Layout Div */}
        </div>
    );
}

export default App;