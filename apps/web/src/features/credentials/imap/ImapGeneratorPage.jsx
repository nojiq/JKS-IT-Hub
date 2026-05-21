import { useSearchParams } from "react-router-dom";
import ProviderImapPanel from "./ProviderImapPanel.jsx";
import "./ImapGeneratorPage.css";

const ImapGeneratorPage = () => {
    const [searchParams] = useSearchParams();
    const userId = searchParams.get("userId") || "";

    return (
        <section className="workspace-page users-page imap-generator-page">
            <header className="imap-generator-header">
                <h1>IMAP Passwords</h1>
            </header>

            <ProviderImapPanel initialUserId={userId} />
        </section>
    );
};

export default ImapGeneratorPage;
