import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePassword,
  validateEmail,
  validateUserSignup,
  validateDoctorSignup,
} from '../src/utils/security.js';

describe('Password Security Policy (Length 8-12, Chars and Int)', () => {
  test('valid passwords with 8-12 characters, letters, and numbers should pass', () => {
    assert.equal(validatePassword('mediraksha1').isValid, true);
    assert.equal(validatePassword('Pass1234').isValid, true);
    assert.equal(validatePassword('A1b2C3d4').isValid, true);
    assert.equal(validatePassword('SecurePass99').isValid, true);
    assert.equal(validatePassword('Doctor2026').isValid, true);
    assert.equal(validatePassword('User@1234').isValid, true);
  });

  test('passwords shorter than 8 characters should fail', () => {
    const res1 = validatePassword('Med1');
    assert.equal(res1.isValid, false);
    assert.match(res1.message, /between 8 and 12 characters/i);

    const res2 = validatePassword('Pass123'); // 7 characters
    assert.equal(res2.isValid, false);
    assert.match(res2.message, /between 8 and 12 characters/i);
  });

  test('passwords longer than 12 characters should fail', () => {
    const res1 = validatePassword('Mediraksha12345'); // 15 characters
    assert.equal(res1.isValid, false);
    assert.match(res1.message, /between 8 and 12 characters/i);

    const res2 = validatePassword('Password12345'); // 13 characters
    assert.equal(res2.isValid, false);
    assert.match(res2.message, /between 8 and 12 characters/i);
  });

  test('passwords without numbers (only letters) should fail', () => {
    const res = validatePassword('Mediraksha');
    assert.equal(res.isValid, false);
    assert.match(res.message, /both letters and numbers/i);
  });

  test('passwords without letters (only numbers) should fail', () => {
    const res = validatePassword('1234567890');
    assert.equal(res.isValid, false);
    assert.match(res.message, /both letters and numbers/i);
  });

  test('passwords containing spaces should fail', () => {
    const res = validatePassword('Pass 12345');
    assert.equal(res.isValid, false);
    assert.match(res.message, /spaces/i);
  });

  test('empty or invalid password inputs should fail', () => {
    assert.equal(validatePassword('').isValid, false);
    assert.equal(validatePassword(null).isValid, false);
    assert.equal(validatePassword(undefined).isValid, false);
    assert.equal(validatePassword(12345678).isValid, false);
  });
});

describe('Email Validation & Sanitization', () => {
  test('valid emails should be accepted and lowercased', () => {
    const res = validateEmail('  User.Test@Hospital.COM  ');
    assert.equal(res.isValid, true);
    assert.equal(res.normalizedEmail, 'user.test@hospital.com');
  });

  test('malformed emails should fail', () => {
    assert.equal(validateEmail('invalid-email').isValid, false);
    assert.equal(validateEmail('@domain.com').isValid, false);
    assert.equal(validateEmail('user@').isValid, false);
    assert.equal(validateEmail('').isValid, false);
  });
});

describe('User & Doctor Signup Input Validation', () => {
  test('valid user signup payload passes', () => {
    const validData = {
      name: 'John Doe',
      email: 'john@example.com',
      age: 28,
      gender: 'male',
      number: '9876543210',
      password: 'Password12',
    };
    const result = validateUserSignup(validData);
    assert.equal(result.isValid, true);
    assert.equal(result.sanitizedData.email, 'john@example.com');
  });

  test('user signup with invalid age or gender fails', () => {
    const invalidAge = {
      name: 'John Doe',
      email: 'john@example.com',
      age: 150,
      gender: 'male',
      password: 'Password12',
    };
    assert.equal(validateUserSignup(invalidAge).isValid, false);

    const invalidGender = {
      name: 'John Doe',
      email: 'john@example.com',
      age: 25,
      gender: 'invalid_gender',
      password: 'Password12',
    };
    assert.equal(validateUserSignup(invalidGender).isValid, false);
  });

  test('valid doctor signup payload passes', () => {
    const validDoctor = {
      name: 'Dr. Jane Smith',
      email: 'dr.smith@cityhospital.com',
      number: '9876543210',
      age: 38,
      gender: 'female',
      hospital: 'City General Hospital',
      speciality: 'Cardiology',
      password: 'DoctorPass1',
    };
    const result = validateDoctorSignup(validDoctor);
    assert.equal(result.isValid, true);
    assert.equal(result.sanitizedData.speciality, 'Cardiology');
  });
});
