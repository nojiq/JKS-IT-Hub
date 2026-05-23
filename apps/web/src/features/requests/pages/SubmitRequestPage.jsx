import { Navigate } from "react-router-dom";

const SubmitRequestPage = () => (
    <Navigate to="/requests/my-requests?submit=1" replace />
);

export default SubmitRequestPage;
