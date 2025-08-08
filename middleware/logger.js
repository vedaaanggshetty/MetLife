const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Custom logger middleware
const logger = (req, res, next) => {
  const start = Date.now();
  
  // Log request
  const requestLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    userId: req.user ? req.user._id : null,
    body: req.method === 'POST' || req.method === 'PUT' ? 
      JSON.stringify(req.body).substring(0, 1000) : null // Limit body log size
  };

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - start;
    
    const responseLog = {
      ...requestLog,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      responseSize: JSON.stringify(data).length
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
    }

    // Log to file
    logToFile(responseLog);

    return originalJson.call(this, data);
  };

  next();
};

// Log to file function
const logToFile = (logData) => {
  const logLevel = logData.statusCode >= 400 ? 'error' : 'info';
  const logFile = path.join(logsDir, `${logLevel}.log`);
  
  const logEntry = `${JSON.stringify(logData)}\n`;
  
  fs.appendFile(logFile, logEntry, (err) => {
    if (err) {
      console.error('Error writing to log file:', err);
    }
  });
};

// Log rotation (daily)
const rotateLog = () => {
  const today = new Date().toISOString().split('T')[0];
  const logFiles = ['info.log', 'error.log'];
  
  logFiles.forEach(file => {
    const currentPath = path.join(logsDir, file);
    const archivePath = path.join(logsDir, `${today}-${file}`);
    
    if (fs.existsSync(currentPath)) {
      fs.rename(currentPath, archivePath, (err) => {
        if (err) {
          console.error(`Error rotating log file ${file}:`, err);
        }
      });
    }
  });
};

// Rotate logs daily at midnight
const scheduleLogRotation = () => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const msUntilMidnight = tomorrow.getTime() - now.getTime();
  
  setTimeout(() => {
    rotateLog();
    // Schedule next rotation
    setInterval(rotateLog, 24 * 60 * 60 * 1000); // 24 hours
  }, msUntilMidnight);
};

// Start log rotation scheduler
scheduleLogRotation();

// Clean old logs (keep only 30 days)
const cleanOldLogs = () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  fs.readdir(logsDir, (err, files) => {
    if (err) return;
    
    files.forEach(file => {
      const filePath = path.join(logsDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        
        if (stats.mtime < thirtyDaysAgo) {
          fs.unlink(filePath, (err) => {
            if (err) {
              console.error(`Error deleting old log file ${file}:`, err);
            }
          });
        }
      });
    });
  });
};

// Clean old logs weekly
setInterval(cleanOldLogs, 7 * 24 * 60 * 60 * 1000); // 7 days

module.exports = logger;