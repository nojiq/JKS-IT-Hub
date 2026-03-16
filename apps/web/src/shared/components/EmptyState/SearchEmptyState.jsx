
import { EmptyState } from './EmptyState';
import './EmptyState.css';

const SearchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
);

export const SearchEmptyState = ({
    searchTerm,
    onClear
}) => {
    return (
        <EmptyState
            icon={<SearchIcon />}
            title={searchTerm ? `No results found for "${searchTerm}"` : "No results found"}
            description="We couldn't find any items matching your search criteria. Try adjusting your search or filters."
            action={
                onClear ? (
                    <button
                        onClick={onClear}
                        className="empty-state-action"
                        type="button"
                    >
                        Clear All Filters
                    </button>
                ) : null
            }
        />
    );
};
