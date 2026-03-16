import React from 'react';
import RequestForm from '../components/RequestForm.jsx';

const SubmitRequestPage = () => {
    return (
        <div style={{ padding: '2rem' }}>
            <h1 style={{ marginBottom: '2rem' }}>Submit New Request</h1>
            <RequestForm />
        </div>
    );
};

export default SubmitRequestPage;
