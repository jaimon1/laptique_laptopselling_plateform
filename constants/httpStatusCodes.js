/**
 * HTTP Status Codes Constants
 * Using enums for better code maintainability and consistency
 */

const HTTP_STATUS = {
    // Success Responses (2xx)
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,

    // Redirection Messages (3xx)
    MOVED_PERMANENTLY: 301,
    FOUND: 302,
    NOT_MODIFIED: 304,

    // Client Error Responses (4xx)
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,

    // Server Error Responses (5xx)
    INTERNAL_SERVER_ERROR: 500,
    NOT_IMPLEMENTED: 501,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504
};

// Freeze the object to prevent modifications
Object.freeze(HTTP_STATUS);

export default HTTP_STATUS;
