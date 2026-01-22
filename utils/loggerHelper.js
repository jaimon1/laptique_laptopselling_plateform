import logger from '../config/logger.js';

export const logControllerError = (controllerName, methodName, error, additionalData = {}) => {
    logger.error(`${controllerName}.${methodName}`, {
        error: error.message,
        stack: error.stack,
        ...additionalData
    });
};

export const logControllerInfo = (controllerName, methodName, message, data = {}) => {
    logger.info(`${controllerName}.${methodName}`, {
        message,
        ...data
    });
};

export const logControllerWarn = (controllerName, methodName, message, data = {}) => {
    logger.warn(`${controllerName}.${methodName}`, {
        message,
        ...data
    });
};

export const logDatabaseOperation = (operation, collection, data = {}) => {
    logger.info('Database Operation', {
        operation,
        collection,
        ...data
    });
};

export const logAuthAttempt = (type, email, success, reason = null) => {
    const logData = {
        type,
        email,
        success,
        timestamp: new Date().toISOString()
    };

    if (reason) {
        logData.reason = reason;
    }

    if (success) {
        logger.info('Authentication Success', logData);
    } else {
        logger.warn('Authentication Failed', logData);
    }
};

export const logPaymentOperation = (operation, orderId, amount, status, additionalData = {}) => {
    logger.info('Payment Operation', {
        operation,
        orderId,
        amount,
        status,
        ...additionalData
    });
};

export const logOrderOperation = (operation, orderId, userId, additionalData = {}) => {
    logger.info('Order Operation', {
        operation,
        orderId,
        userId,
        ...additionalData
    });
};

export default {
    logControllerError,
    logControllerInfo,
    logControllerWarn,
    logDatabaseOperation,
    logAuthAttempt,
    logPaymentOperation,
    logOrderOperation
};
