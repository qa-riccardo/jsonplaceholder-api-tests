import isEmail from 'validator/lib/isEmail.js';

export function isValidEmail(email) {
  return isEmail(email, { allow_utf8_local_part: true });
}

export function findInvalidEmails(emails) {
  return emails.filter((e) => !isValidEmail(e));
}
