

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
