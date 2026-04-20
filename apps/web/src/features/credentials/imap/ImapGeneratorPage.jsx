import ImapFieldWorkbench from "./ImapFieldWorkbench.jsx";
import ImapPreviewInspector from "./ImapPreviewInspector.jsx";
import ImapUserResolver from "./ImapUserResolver.jsx";
import "./ImapGeneratorPage.css";

const ImapGeneratorPage = () => {
    return (
        <section className="workspace-page users-page imap-generator-page">
            <header className="imap-generator-header">
                <h1>IMAP Generator</h1>
                <p>Resolve a user, edit the IMAP profile fields, and preview deterministic passwords before saving.</p>
            </header>

            <div className="imap-generator-shell">
                <div className="imap-generator-workbench">
                    <ImapUserResolver />
                    <ImapFieldWorkbench />
                </div>

                <ImapPreviewInspector />
            </div>
        </section>
    );
};

export default ImapGeneratorPage;
