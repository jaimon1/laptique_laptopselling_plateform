/**
 * Constants Index
 * Central export point for all application constants
 */

import HTTP_STATUS from './httpStatusCodes.js';
import ERROR_MESSAGES, { getErrorMessage } from './errorMessages.js';
import SUCCESS_MESSAGES, { getSuccessMessage } from './successMessages.js';

export {
    HTTP_STATUS,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES,
    getErrorMessage,
    getSuccessMessage
};

// Default export for convenience
export default {
    HTTP_STATUS,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES,
    getErrorMessage,
    getSuccessMessage
};
