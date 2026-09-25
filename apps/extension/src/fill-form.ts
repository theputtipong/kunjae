export const fillCredentials = (username: string, password: string): boolean => {
  const isVisible = (element: HTMLElement): boolean =>
    element.offsetParent !== null && !element.hidden;

  const passwordField = [...document.querySelectorAll("input[type='password']")].find(
    (element): element is HTMLInputElement =>
      element instanceof HTMLInputElement && isVisible(element),
  );

  if (passwordField === undefined) return false;

  const form = passwordField.form;
  const candidates = form === null ? [] : [...form.querySelectorAll("input")];
  const passwordIndex = candidates.indexOf(passwordField);

  const usernameField = candidates
    .slice(0, passwordIndex < 0 ? 0 : passwordIndex)
    .reverse()
    .find(
      (element) =>
        (element.type === "text" || element.type === "email") && isVisible(element),
    );

  const setValue = (field: HTMLInputElement, value: string): void => {
    field.focus();
    field.value = value;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  };

  if (usernameField !== undefined && username !== "") setValue(usernameField, username);
  setValue(passwordField, password);

  return true;
};

export const fillOtpCode = (code: string): boolean => {
  const isVisible = (element: HTMLElement): boolean =>
    element.offsetParent !== null && !element.hidden;

  const fields = [...document.querySelectorAll("input[autocomplete='one-time-code']")].filter(
    (element): element is HTMLInputElement =>
      element instanceof HTMLInputElement && isVisible(element) && !element.disabled,
  );

  if (fields.length === 0) return false;

  const setValue = (field: HTMLInputElement, value: string): void => {
    field.focus();
    field.value = value;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const only = fields[0];
  if (fields.length === 1 && only !== undefined) {
    setValue(only, code);
    return true;
  }

  if (fields.length !== code.length) return false;

  fields.forEach((field, index) => {
    setValue(field, code.charAt(index));
  });

  return true;
};
