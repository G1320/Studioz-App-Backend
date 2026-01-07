

export const initializeAvailability = (itemAvailability?: any[]): any[] => {
    return itemAvailability || []; 
};


// Function to find or create availability entry for a specific date
export const findOrCreateDateAvailability = (availability: any[], bookingDate: string, defaultHours: string[]) => {
    let dateAvailability = availability.find(avail => avail.date === bookingDate) ||
        { date: bookingDate, times: [...defaultHours] };

    if (!availability.some(avail => avail.date === bookingDate)) {
        availability.push(dateAvailability);
    }

    return dateAvailability;
};

// Function to generate an array of time slots for a given start time and duration
export const generateTimeSlots = (startTime: string, hours: number) => {
    const startHour = parseInt(startTime?.split(':')[0]);
    return Array.from({ length: hours }, (_, i) => `${String(startHour + i).padStart(2, '0')}:00`);
};

// Function to check if all requested time slots are available
export const areAllSlotsAvailable = (timeSlots: string[], availableTimes: string[]) => {
    return timeSlots.every(slot => availableTimes.includes(slot));
};

// Function to remove selected time slots from available times
export const removeTimeSlots = (availableTimes: string[], timeSlots: string[]) => {
    return availableTimes.filter(time => !timeSlots.includes(time));
};


export const addTimeSlots = (currentTimes: string[], timeSlotsToAdd: string[]): string[] => {
    // Combine and remove duplicates to ensure time slots are unique
    const updatedTimes = Array.from(new Set([...currentTimes, ...timeSlotsToAdd]));
    // Sort times in ascending order
    updatedTimes.sort();
    return updatedTimes;
}

// Default fallback hours (all 24 hours)
export const DEFAULT_HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

// Generate hour slots from studio availability time ranges
// e.g., { start: '09:00', end: '21:00' } -> ['09:00', '10:00', ..., '20:00']
export const generateHoursFromTimeRanges = (
    timeRanges: { start: string; end: string }[] | undefined
): string[] => {
    if (!timeRanges || timeRanges.length === 0) {
        return DEFAULT_HOURS;
    }

    const hours: string[] = [];
    
    for (const range of timeRanges) {
        const startHour = parseInt(range.start?.split(':')[0] || '0');
        const endHour = parseInt(range.end?.split(':')[0] || '24');
        
        // Generate hour slots from start to end (exclusive of end hour)
        for (let hour = startHour; hour < endHour; hour++) {
            const slot = `${String(hour).padStart(2, '0')}:00`;
            if (!hours.includes(slot)) {
                hours.push(slot);
            }
        }
    }

    hours.sort();
    return hours.length > 0 ? hours : DEFAULT_HOURS;
}

// Check if a date falls on a studio's operating day
export const isOperatingDay = (
    bookingDate: string,
    operatingDays: string[] | undefined
): boolean => {
    if (!operatingDays || operatingDays.length === 0) {
        return true; // If no days configured, assume all days are open
    }
    
    const date = new Date(bookingDate);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = dayNames[date.getDay()];
    
    return operatingDays.includes(dayOfWeek);
}
