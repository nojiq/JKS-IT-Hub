import { useState } from 'react';

const LdapFieldSelector = ({ 
    availableFields = [], 
    selectedField, 
    onSelect, 
    placeholder = "Select LDAP field...",
    disabled = false,
    className = ""
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredFields = availableFields.filter(field =>
        field.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelect = (field) => {
        onSelect(field);
        setIsOpen(false);
        setSearchTerm('');
    };

    const handleToggle = () => {
        if (!disabled) {
            setIsOpen(!isOpen);
        }
    };

    return (
        <div className={`ldap-field-selector ${className}`}>
            <div
                className={`selector-trigger ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
                onClick={handleToggle}
            >
                <span className={selectedField ? 'selected' : 'placeholder'}>
                    {selectedField || placeholder}
                </span>
                <span className="dropdown-arrow">▼</span>
            </div>

            {isOpen && (
                <div className="dropdown-menu">
                    <div className="search-box">
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search fields..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="fields-list">
                        {filteredFields.length === 0 ? (
                            <div className="no-results">No fields found</div>
                        ) : (
                            filteredFields.map((field) => (
                                <div
                                    key={field}
                                    className={`field-option ${selectedField === field ? 'selected' : ''}`}
                                    onClick={() => handleSelect(field)}
                                >
                                    <span className="field-name">{field}</span>
                                    {selectedField === field && (
                                        <span className="check-mark">✓</span>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LdapFieldSelector;
