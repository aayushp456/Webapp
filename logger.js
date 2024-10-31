const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, errors } = format;
const path = require('path');
const fs = require('fs');


const customFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
});

const logger = createLogger({
    level: 'info',  
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),  
        customFormat
    ),
    transports: [
        new transports.Console(),
        new transports.File({ filename: "/var/log/myapp/application.log" })
    ],
    exitOnError: false
});

module.exports = logger;