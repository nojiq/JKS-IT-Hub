export const createProblemDetails = ({
  status,
  title,
  detail,
  type = "about:blank",
  instance,
  ...extensions
}) => ({
  type,
  title,
  status,
  detail,
  ...(instance ? { instance } : {}),
  ...extensions
});

export const sendProblem = (reply, problem) => {
  return reply
    .type("application/problem+json")
    .code(problem.status)
    .send(problem);
};
