export class OnboardingNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "OnboardingNotFoundError";
    this.code = "ONBOARDING_NOT_FOUND";
  }
}

export class OnboardingValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "OnboardingValidationError";
    this.code = "ONBOARDING_VALIDATION";
    this.details = details;
  }
}
