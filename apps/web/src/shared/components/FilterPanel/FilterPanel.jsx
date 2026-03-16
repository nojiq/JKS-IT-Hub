import { FilterPanel as SharedFilterPanel } from '../../ui/FilterPanel/FilterPanel';
import './FilterPanel.css';

export const FilterPanel = (props) => {
    return <SharedFilterPanel showChips={false} {...props} />;
};
