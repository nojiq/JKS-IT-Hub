import './CredentialPreview.css';

/**
 * ConfirmationForm Component
 * 
 * Provides explicit confirmation UI with checkbox and warning text.
 * The confirmation checkbox must be checked before credentials can be saved.
 * 
 * @param {Object} props
 * @param {boolean} props.confirmed - Whether the user has checked the confirmation box
 * @param {Function} props.onConfirmedChange - Callback when confirmation state changes
 * @param {boolean} props.disabled - Whether the form should be disabled
 */
function ConfirmationForm({ confirmed, onConfirmedChange, disabled }) {
  return (
    <div className={`confirmation-form ${confirmed ? 'highlighted' : ''}`}>
      <label className="confirmation-checkbox">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => onConfirmedChange(e.target.checked)}
          disabled={disabled}
        />
        <span className="confirmation-text">
          I have reviewed and <strong>confirm these credentials are correct</strong>. 
          I understand that once saved, these credentials will be activated immediately.
        </span>
      </label>

      <div className="confirmation-warning">
        <strong>⚠️ Important:</strong> This action will save and activate the credentials 
        for all shown systems. Please verify all usernames and passwords before confirming.
      </div>
    </div>
  );
}

export default ConfirmationForm;
