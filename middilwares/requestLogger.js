import logger from '../config/logger.js';

const requestLogger = (req, res, next) => {
    const startTime = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logData = {
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('user-agent'),
        };

        if (req.session?.user) {
            logData.userId = req.session.user._id;
            logData.userEmail = req.session.user.email;
        }

        if (res.statusCode >= 500) {
            logger.error('Server Error', logData);
        } else if (res.statusCode >= 400) {
            logger.warn('Client Error', logData);
        } else {
            logger.http('Request', logData);
        }
    });

    next();
};

export default requestLogger;
