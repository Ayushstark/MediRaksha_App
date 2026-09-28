import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { doctorVerify, userVerify } from '../src/middlewares/authVerify.js';

describe('Role-Based Access Control and Token Verification', () => {
  const TEST_SECRET = 'ci-test-secret-key-12345';

  test('userVerify blocks doctor tokens from accessing user endpoints', () => {
    let statusCode = null;
    let responseBody = null;

    const req = {
      user: { id: 1, role: 'doctor' }
    };
    const res = {
      status(code) {
        statusCode = code;
        return {
          json(body) {
            responseBody = body;
          }
        };
      }
    };
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    userVerify(req, res, next);
    assert.equal(statusCode, 403);
    assert.equal(responseBody.success, false);
    assert.equal(nextCalled, false);
  });

  test('doctorVerify blocks regular user tokens from accessing doctor endpoints', () => {
    let statusCode = null;
    let responseBody = null;

    const req = {
      user: { id: 1, role: 'user' }
    };
    const res = {
      status(code) {
        statusCode = code;
        return {
          json(body) {
            responseBody = body;
          }
        };
      }
    };
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    doctorVerify(req, res, next);
    assert.equal(statusCode, 403);
    assert.equal(responseBody.success, false);
    assert.equal(nextCalled, false);
  });

  test('doctorVerify permits valid doctor tokens', () => {
    const req = {
      user: { id: 10, role: 'doctor' }
    };
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    doctorVerify(req, {}, next);
    assert.equal(nextCalled, true);
  });

  test('userVerify permits valid user tokens', () => {
    const req = {
      user: { id: 25, role: 'user' }
    };
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    userVerify(req, {}, next);
    assert.equal(nextCalled, true);
  });
});
