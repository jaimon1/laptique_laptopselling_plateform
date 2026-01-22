import logger from '../config/logger.js';

const errorLogger = (err, req, res, next) => {
    const errorData = {
        message: err.message,
        stack: err.stack,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        body: req.body,
        params: req.params,
        query: req.query,
    };

    if (req.session?.user) {
        errorData.userId = req.session.user._id;
        errorData.userEmail = req.session.user.email;
    }

    logger.error('Unhandled Error', errorData);

    if (res.headersSent) {
        return next(err);
    }

    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        message: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
};

export default errorLogger;
