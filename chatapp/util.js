/**
 * Utility functions and classes
 */

var crypto = require('crypto');

const SALT_LENGTH = 8;

class PasswordManager {

    constructor(salt = null, hashedPassword = null) {
        if (!salt) {
            this._generateSalt();
        } else {
            this.salt = salt.trim().slice(0, SALT_LENGTH);
        }

        this.hashedPassword = hashedPassword;
    }

    /**
     * Parses a bcrypt style string and returns an instance of this class. Useful for reading passwords from a
     * database for validation.
     * @param str A bcrypt style password string. The salt is in $salt$ delimiters.
     */
    static fromString(str) {
        if (!str) {
            throw new TypeError('Hashed password cannot be null or empty.');
        }

        let passwordRegex = /^\$(\w+?)\$(\w+)$/;
        let matches = passwordRegex.exec(str);

        if (matches === null) {
            throw new TypeError('Hashed password with invalid format.');
        }

        let salt = matches[1];
        let hashedPassword = matches[2];

        return new PasswordManager(salt, hashedPassword);
    }

    _generateSalt() {
        this.salt = crypto.randomBytes(Math.ceil(SALT_LENGTH / 2)).toString('hex').slice(0, SALT_LENGTH);
    }

    generatePassword(password) {
        if (!password) {
            throw new TypeError('Password cannot be null or empty.');
        }

        let hash = crypto.createHash('sha256');
        hash.update(this.salt);
        hash.update(password);
        this.hashedPassword = hash.digest('hex');
        return `\$${this.salt}\$${this.hashedPassword}`;
    }

    /**
     * Checks if the password corresponds to the hashed password stored in this instance.
     * To use this method, this instance must have a stored hashed password. To achieve this, get an instance of this
     * class using the fromString method, or fill this instance with a hashedPassword with the generatePassword
     * method.
     * @param password Clear text password to validate.
     */
    checkPassword(password) {
        if (!password) {
            return false;
        }

        let hash = crypto.createHash('sha256');
        hash.update(this.salt);
        hash.update(password);
        return hash.digest('hex') === this.hashedPassword;
    }
}

module.exports = {
    PasswordManager
};
