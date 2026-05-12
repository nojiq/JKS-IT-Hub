import './CredentialList.css';
import { ItOnlyBadge } from './ItOnlyBadge.jsx';

const CredentialList = ({ credentials }) => {
    if (!credentials || credentials.length === 0) {
        return (
            <div className="credentials-empty">
                <p>No active credentials for this user.</p>
            </div>
        );
    }

    return (
        <div className="credential-list-wrapper">
            <div className="credentials-list">
                {credentials.map((credential) => {
                    const systemId = credential.systemId || credential.system;
                    const systemName = credential.systemConfig?.description || systemId;

                    return (
                        <div key={credential.id} className="credential-item">
                            <div className="credential-main">
                                <div className="credential-system">
                                    <span className="system-name">{systemName}</span>
                                    {credential.systemConfig?.isItOnly && <ItOnlyBadge />}
                                </div>
                                <div className="credential-details">
                                    <span className="credential-username">{credential.username}</span>
                                    <span className="credential-version">v{credential.templateVersion}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CredentialList;
