import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/maintenanceApi.js";
import * as preventiveApi from "../api/preventiveMaintenanceApi.js";

export const maintenanceConfigViewStates = Object.freeze({
    loading: 'loading',
    empty: 'empty',
    success: 'success',
    error: 'error'
});

// Keys
export const maintenanceKeys = {
    all: ["maintenance"],
    cycles: () => [...maintenanceKeys.all, "cycles"],
    cycle: (id) => [...maintenanceKeys.cycles(), id],
    windows: (filters) => [...maintenanceKeys.all, "windows", filters],
    window: (id) => [...maintenanceKeys.all, "windows", id],
    completion: (id) => [...maintenanceKeys.all, "completion", id],
    eligibility: (id) => [...maintenanceKeys.all, "eligibility", id],
    history: (filters) => [...maintenanceKeys.all, "history", filters],
    checklists: (includeInactive = false) => [...maintenanceKeys.all, "checklists", { includeInactive }],
    checklist: (id) => [...maintenanceKeys.all, "checklists", id],
};

// Cycles
export const useCycles = (includeInactive = false) => {
    return useQuery({
        queryKey: [...maintenanceKeys.cycles(), { includeInactive }],
        queryFn: () => api.fetchCycles(includeInactive),
    });
};

export const useMaintenanceConfig = (includeInactive = false) => {
    const query = useCycles(includeInactive);
    const isLoading = query.isLoading && !query.data;
    const isError = Boolean(query.isError);
    const cycles = isError ? [] : (Array.isArray(query.data) ? query.data : []);

    let viewState = maintenanceConfigViewStates.success;
    if (isLoading) {
        viewState = maintenanceConfigViewStates.loading;
    } else if (isError) {
        viewState = maintenanceConfigViewStates.error;
    } else if (cycles.length === 0) {
        viewState = maintenanceConfigViewStates.empty;
    }

    return {
        ...query,
        cycles,
        viewState
    };
};

export const useCycle = (id) => {
    return useQuery({
        queryKey: maintenanceKeys.cycle(id),
        queryFn: () => api.fetchCycle(id),
        enabled: !!id,
    });
};

export const useCreateCycle = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.createCycle,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: maintenanceKeys.cycles() });
        },
    });
};

export const useUpdateCycle = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => api.updateCycle(id, data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: maintenanceKeys.cycles() });
            queryClient.invalidateQueries({ queryKey: maintenanceKeys.cycle(data.id) });
        },
    });
};

export const useDeactivateCycle = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.deleteCycle,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: maintenanceKeys.cycles() });
            queryClient.invalidateQueries({ queryKey: maintenanceKeys.cycle(data.id) });
        },
    });
};

export const useChecklistTemplates = (includeInactive = false) => {
    return useQuery({
        queryKey: maintenanceKeys.checklists(includeInactive),
        queryFn: () => api.fetchChecklistTemplates(includeInactive),
    });
};

export const useChecklistTemplate = (id) => {
    return useQuery({
        queryKey: maintenanceKeys.checklist(id),
        queryFn: () => api.fetchChecklistTemplate(id),
        enabled: !!id
    });
};

export const useCreateChecklistTemplate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.createChecklistTemplate,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: maintenanceKeys.all });
        }
    });
};

export const useUpdateChecklistTemplate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => api.updateChecklistTemplate(id, data),
        onSuccess: (template) => {
            queryClient.invalidateQueries({ queryKey: maintenanceKeys.all });
            if (template?.id) {
                queryClient.invalidateQueries({ queryKey: maintenanceKeys.checklist(template.id) });
            }
        }
    });
};

export const useDeactivateChecklistTemplate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.deactivateChecklistTemplate,
        onSuccess: (template) => {
            queryClient.invalidateQueries({ queryKey: maintenanceKeys.all });
            if (template?.id) {
                queryClient.invalidateQueries({ queryKey: maintenanceKeys.checklist(template.id) });
            }
        }
    });
};

export const useDeleteChecklistTemplate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.deleteChecklistTemplate,
        onSuccess: (_result, id) => {
            queryClient.invalidateQueries({ queryKey: maintenanceKeys.all });
            queryClient.removeQueries({ queryKey: maintenanceKeys.checklist(id) });
        }
    });
};

// Windows
export const useWindows = (filters = {}) => {
    return useQuery({
        queryKey: maintenanceKeys.windows(filters),
        queryFn: () => api.fetchWindows(filters),
        placeholderData: keepPreviousData,
    });
};

export const useWindow = (id) => {
    return useQuery({
        queryKey: maintenanceKeys.window(id),
        queryFn: () => api.fetchWindow(id),
        enabled: !!id,
    });
};

export const useMaintenanceCompletion = (id) => {
    return useQuery({
        queryKey: maintenanceKeys.completion(id),
        queryFn: () => api.fetchCompletionDetails(id),
        enabled: !!id,
    });
};

export const useSignOffEligibility = (id) => {
    return useQuery({
        queryKey: maintenanceKeys.eligibility(id),
        queryFn: () => api.fetchSignOffEligibility(id),
        enabled: !!id,
    });
};

export const useCreateWindow = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.createWindow,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: maintenanceKeys.all });
        },
    });
};

export const useUpdateWindow = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => api.updateWindow(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: maintenanceKeys.all });
        },
    });
};

export const useCancelWindow = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, reason }) => api.cancelWindow(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: maintenanceKeys.all });
        },
    });
};

export const useGenerateSchedule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ cycleId, options }) => api.generateSchedule(cycleId, options),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: maintenanceKeys.all });
        },
    });
};

export const useSignOffWindow = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => api.signOffWindow(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: maintenanceKeys.all });
        },
    });
};

export const useSignOffMaintenance = useSignOffWindow;

export const useMaintenanceHistory = (filters = {}) => {
    return useQuery({
        queryKey: maintenanceKeys.history(filters),
        queryFn: () => api.fetchCompletionHistory(filters),
        placeholderData: keepPreviousData,
    });
};

export const useMyCompletionHistory = useMaintenanceHistory;

// Assignment Rules
export const assignmentRulesKeys = {
    all: () => [...maintenanceKeys.all, "assignment-rules"],
    list: (includeInactive) => [...assignmentRulesKeys.all(), { includeInactive }],
    rule: (id) => [...assignmentRulesKeys.all(), id],
    myTasks: (filters = {}) => [...maintenanceKeys.all, "my-tasks", filters],
};

export const useAssignmentRules = (includeInactive = false) => {
    return useQuery({
        queryKey: assignmentRulesKeys.list(includeInactive),
        queryFn: () => api.fetchAssignmentRules(includeInactive),
    });
};

export const useAssignmentRule = (id) => {
    return useQuery({
        queryKey: assignmentRulesKeys.rule(id),
        queryFn: () => api.fetchAssignmentRule(id),
        enabled: !!id,
    });
};

export const useCreateAssignmentRule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.createAssignmentRule,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: assignmentRulesKeys.all() });
        },
    });
};

export const useUpdateAssignmentRule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => api.updateAssignmentRule(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: assignmentRulesKeys.all() });
        },
    });
};

export const useDeactivateAssignmentRule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.deactivateAssignmentRule,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: assignmentRulesKeys.all() });
        },
    });
};

export const useResetRotation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.resetRotation,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: assignmentRulesKeys.all() });
        },
    });
};

export const useManuallyAssignWindow = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ windowId, userId }) => api.manuallyAssignWindow(windowId, userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: maintenanceKeys.all });
            queryClient.invalidateQueries({ queryKey: [...maintenanceKeys.all, "my-tasks"] });
        },
    });
};

export const useMyMaintenanceWindows = (filters = {}) => {
    return useQuery({
        queryKey: assignmentRulesKeys.myTasks(filters),
        queryFn: () => api.fetchMyMaintenanceWindows(filters),
        placeholderData: keepPreviousData
    });
};

export const preventiveKeys = {
    all: [...maintenanceKeys.all, 'preventive'],
    profiles: (includeInactive) => [...preventiveKeys.all, 'profiles', { includeInactive }],
    matrix: () => [...preventiveKeys.all, 'matrix'],
    myRuns: (filters) => [...preventiveKeys.all, 'my-runs', filters],
    run: (id) => [...preventiveKeys.all, 'run', id],
    history: (filters) => [...preventiveKeys.all, 'history', filters]
};

export const useMaintenanceProfiles = (includeInactive = false) => {
    return useQuery({
        queryKey: preventiveKeys.profiles(includeInactive),
        queryFn: () => preventiveApi.fetchMaintenanceProfiles(includeInactive)
    });
};

export const useCreateMaintenanceProfile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: preventiveApi.createMaintenanceProfile,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: preventiveKeys.all });
        }
    });
};

export const useUpdateMaintenanceProfile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => preventiveApi.updateMaintenanceProfile(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: preventiveKeys.all });
        }
    });
};

export const useSaveProfileChecklist = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ profileId, items }) => preventiveApi.saveProfileChecklist(profileId, items),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: preventiveKeys.all });
        }
    });
};

export const useAssignmentMatrix = () => {
    return useQuery({
        queryKey: preventiveKeys.matrix(),
        queryFn: () => preventiveApi.fetchAssignmentMatrix()
    });
};

export const useCreateMaintenanceAssignment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: preventiveApi.createMaintenanceAssignment,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: preventiveKeys.all });
        }
    });
};

export const useMyMaintenanceRuns = (filters = {}) => {
    return useQuery({
        queryKey: preventiveKeys.myRuns(filters),
        queryFn: () => preventiveApi.fetchMyMaintenanceRuns(filters),
        placeholderData: keepPreviousData
    });
};

export const useMaintenanceRunHistory = (filters = {}) => {
    return useQuery({
        queryKey: preventiveKeys.history(filters),
        queryFn: () => preventiveApi.fetchMaintenanceRunHistory(filters),
        placeholderData: keepPreviousData
    });
};

export const useMaintenanceRun = (id, enabled = true) => {
    return useQuery({
        queryKey: preventiveKeys.run(id),
        queryFn: () => preventiveApi.fetchMaintenanceRun(id),
        enabled: Boolean(id) && enabled
    });
};

export const useStartMaintenanceRun = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: preventiveApi.startMaintenanceRun,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: preventiveKeys.all });
        }
    });
};

export const useUpdateMaintenanceRunItem = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ itemId, data }) => preventiveApi.updateMaintenanceRunItem(itemId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: preventiveKeys.all });
        }
    });
};

export const useCompleteMaintenanceRun = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: preventiveApi.completeMaintenanceRun,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: preventiveKeys.all });
        }
    });
};

// Story 4.1 compatibility aliases (Task 9 naming)
export const useMaintenanceCycles = useCycles;
export const useCreateMaintenanceCycle = useCreateCycle;
export const useUpdateMaintenanceCycle = useUpdateCycle;
export const useDeactivateMaintenanceCycle = useDeactivateCycle;
export const useMaintenanceWindows = useWindows;
export const useCreateMaintenanceWindow = useCreateWindow;
export const useUpdateMaintenanceWindow = useUpdateWindow;
export const useCancelMaintenanceWindow = useCancelWindow;
