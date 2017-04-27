/**
 * Custom error classes.
 */

class ExtendableError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, this.constructor);
        } else {
            this.stack = (new Error(message)).stack;
        }
    }
}

class ApiError extends ExtendableError {
    constructor(message, code = null, cause = null) {
        super(message);
        this.code = code;
        this.cause = cause;
    }
}

module.exports = {
    ExtendableError,
    ApiError
};