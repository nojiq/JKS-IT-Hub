export const createProblemDetails = ({
  status,
  title,
  detail,
  type = "about:blank",
  instance
}) => ({
  type,
  title,
  status,
  detail,
  ...(instance ? { instance } : {})
});

export const sendProblem = (reply, problem) => {
  return reply
    .type("application/problem+json")
    .code(problem.status)
    .send(problem);
};
