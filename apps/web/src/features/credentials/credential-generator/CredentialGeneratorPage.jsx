import { useSearchParams } from "react-router-dom";
import ImapGeneratorPanel from "../imap/ImapGeneratorPanel.jsx";
import ActualPasswordPanel from "./ActualPasswordPanel.jsx";
import "../imap/ImapGeneratorPage.css";
import "./credential-generator.css";

const CredentialGeneratorPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const userId = searchParams.get("userId") || "";
    const generatorMode = searchParams.get("mode") === "actual" ? "actual" : "imap";

    const setGeneratorMode = (next) => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("mode", next);
        setSearchParams(nextParams, { replace: true });
    };

    return (
        <section className="workspace-page users-page imap-generator-page credential-generator-page">
            <header className="imap-generator-header credential-generator-header">
                <h1>Credential Generator</h1>
                <div aria-label="Generator mode" className="credential-generator-mode-row" role="tablist">
                    <button
                        aria-selected={generatorMode === "imap"}
                        className={`imap-generator-chip${generatorMode === "imap" ? " is-active" : ""}`}
                        onClick={() => setGeneratorMode("imap")}
                        role="tab"
                        type="button"
                    >
                        IMAP
                    </button>
                    <button
                        aria-selected={generatorMode === "actual"}
                        className={`imap-generator-chip${generatorMode === "actual" ? " is-active" : ""}`}
                        onClick={() => setGeneratorMode("actual")}
                        role="tab"
                        type="button"
                    >
                        Actual (Yahoo)
                    </button>
                </div>
            </header>

            {generatorMode === "imap" ? <ImapGeneratorPanel initialUserId={userId} /> : <ActualPasswordPanel />}
        </section>
    );
};

export default CredentialGeneratorPage;
