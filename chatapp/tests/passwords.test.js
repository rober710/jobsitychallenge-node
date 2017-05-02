/**
 * Test suite for the password validator.
 */

var PasswordManager = require('../util').PasswordManager;

test('Salt generation', () => {
    let pm = new PasswordManager();
    expect(pm.salt).toBeTruthy();
    expect(pm.salt.length).toBe(8);
    console.log(pm.salt);
});

test('Password generation', () => {
    let pm = new PasswordManager();
    let password = pm.generatePassword('hello');
    expect(pm.hashedPassword).toBeTruthy();
    expect(pm.hashedPassword.length).toBe(64);
    expect(password).toBeTruthy();
    expect(password.length).toBe(74);
    expect(password).toMatch(/^\$(\w+?)\$(\w+)$/);
    console.log(`salt: ${pm.salt}, hash: ${pm.hashedPassword}, password: ${password}`);
});

test('Hash parsing and validation', () => {
    let encryptedPassword = '$a6d52d06$f4d25a29729eb2e2517a70d41e914c4d22991f6c2ff8ebbb0a60d9a28c174f9c';
    let pm = PasswordManager.fromString(encryptedPassword);
    expect(pm.salt).toBe('a6d52d06');
    expect(pm.hashedPassword).toBe('f4d25a29729eb2e2517a70d41e914c4d22991f6c2ff8ebbb0a60d9a28c174f9c');
    expect(pm.checkPassword('hello')).toBe(true);
    expect(pm.checkPassword('world')).toBe(false);
});

test('Same password different hash', () => {
    let pm1 = new PasswordManager();
    let pm2 = new PasswordManager();

    let pass1 = pm1.generatePassword('hello');
    let pass2 = pm2.generatePassword('hello');

    expect(pass1).not.toEqual(pass2);
    console.log(pass1, pass2);
});
