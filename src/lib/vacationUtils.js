import { differenceInYears, addYears, isBefore, startOfDay, parseISO } from 'date-fns';

/**
 * Calculates the current 'Work Year' for an employee based on their hire date.
 * A work year runs from Hire Date (Year X) to Hire Date (Year X+1).
 */
export function getCurrentWorkYear(hireDateStr) {
    const hireDate = startOfDay(parseISO(hireDateStr));
    const today = startOfDay(new Date());

    // Years of service
    const yearsOfService = differenceInYears(today, hireDate);

    // Current work year start is Hire Date + Years of Service
    const start = addYears(hireDate, yearsOfService);
    const end = addYears(start, 1);

    // If for some reason start is in future (shouldn't happen with diffYears logic but safety check), rollback
    if (isBefore(today, start)) {
        return {
            start: addYears(start, -1),
            end: start,
            yearNumber: yearsOfService
        };
    }

    return {
        start,
        end,
        yearNumber: yearsOfService + 1 // 1st year, 2nd year, etc.
    };
}
