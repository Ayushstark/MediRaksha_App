/**
 * Security & Validation Utilities for MediRaksha
 */

/**
 * Validates password based on security policy:
 * - Length between 8 and 12 characters (inclusive)
 * - Must contain at least one letter (a-z, A-Z)
 * - Must contain at least one integer / digit (0-9)
 * - Must not contain whitespace characters
 *
 * @param {string} password
 * @returns {{ isValid: boolean, message?: string }}
 */
export const validatePassword = (password) => {
  if (typeof password !== 'string' || !password) {
    return {
      isValid: false,
      message: 'Password is required and must be a string.',
    };
  }

  if (password.length < 8 || password.length > 12) {
    return {
      isValid: false,
      message: 'Password must be between 8 and 12 characters in length.',
    };
  }

  if (/\s/.test(password)) {
    return {
      isValid: false,
      message: 'Password must not contain spaces.',
    };
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /\d/.test(password);

  if (!hasLetter || !hasDigit) {
    return {
      isValid: false,
      message: 'Password must contain both letters and numbers (integers).',
    };
  }

  return { isValid: true };
};

/**
 * Validates and normalizes email address.
 *
 * @param {string} email
 * @returns {{ isValid: boolean, normalizedEmail?: string, message?: string }}
 */
export const validateEmail = (email) => {
  if (typeof email !== 'string' || !email.trim()) {
    return {
      isValid: false,
      message: 'A valid email address is required.',
    };
  }

  const normalized = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!emailRegex.test(normalized)) {
    return {
      isValid: false,
      message: 'Invalid email address format.',
    };
  }

  return {
    isValid: true,
    normalizedEmail: normalized,
  };
};

/**
 * Validates user signup input fields.
 *
 * @param {object} data
 * @returns {{ isValid: boolean, message?: string, sanitizedData?: object }}
 */
export const validateUserSignup = (data = {}) => {
  const { name, email, age, gender, number, password } = data;

  if (typeof name !== 'string' || !name.trim()) {
    return { isValid: false, message: 'Full name is required.' };
  }

  const emailCheck = validateEmail(email);
  if (!emailCheck.isValid) {
    return { isValid: false, message: emailCheck.message };
  }

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.isValid) {
    return { isValid: false, message: passwordCheck.message };
  }

  const parsedAge = Number(age);
  if (!Number.isInteger(parsedAge) || parsedAge < 1 || parsedAge > 120) {
    return { isValid: false, message: 'Age must be a valid number between 1 and 120.' };
  }

  const validGenders = ['male', 'female', 'other'];
  if (!validGenders.includes(gender)) {
    return { isValid: false, message: 'Gender must be male, female, or other.' };
  }

  return {
    isValid: true,
    sanitizedData: {
      name: name.trim(),
      email: emailCheck.normalizedEmail,
      age: parsedAge,
      gender,
      number: typeof number === 'string' ? number.trim() : null,
      password,
    },
  };
};

/**
 * Validates doctor signup input fields.
 *
 * @param {object} data
 * @returns {{ isValid: boolean, message?: string, sanitizedData?: object }}
 */
export const validateDoctorSignup = (data = {}) => {
  const { name, email, number, age, gender, hospital, speciality, password } = data;

  if (typeof name !== 'string' || !name.trim()) {
    return { isValid: false, message: 'Doctor full name is required.' };
  }

  const emailCheck = validateEmail(email);
  if (!emailCheck.isValid) {
    return { isValid: false, message: emailCheck.message };
  }

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.isValid) {
    return { isValid: false, message: passwordCheck.message };
  }

  const parsedAge = Number(age);
  if (!Number.isInteger(parsedAge) || parsedAge < 18 || parsedAge > 120) {
    return { isValid: false, message: 'Doctor age must be between 18 and 120.' };
  }

  const validGenders = ['male', 'female', 'other'];
  if (!validGenders.includes(gender)) {
    return { isValid: false, message: 'Gender must be male, female, or other.' };
  }

  if (typeof hospital !== 'string' || !hospital.trim()) {
    return { isValid: false, message: 'Hospital name is required.' };
  }

  if (typeof speciality !== 'string' || !speciality.trim()) {
    return { isValid: false, message: 'Doctor speciality is required.' };
  }

  return {
    isValid: true,
    sanitizedData: {
      name: name.trim(),
      email: emailCheck.normalizedEmail,
      number: typeof number === 'string' ? number.trim() : null,
      age: parsedAge,
      gender,
      hospital: hospital.trim(),
      speciality: speciality.trim(),
      password,
    },
  };
};
