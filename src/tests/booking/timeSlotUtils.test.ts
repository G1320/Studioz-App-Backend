import test from 'node:test';
import assert from 'node:assert/strict';
import {
    initializeAvailability,
    findOrCreateDateAvailability,
    generateTimeSlots,
    areAllSlotsAvailable,
    removeTimeSlots,
    addTimeSlots
} from '../../utils/timeSlotUtils.js';

// Helper to generate default hours array (00:00 to 23:00)
const defaultHours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

// ============================================================================
// initializeAvailability Tests
// ============================================================================

test('initializeAvailability returns empty array when input is undefined', () => {
    const result = initializeAvailability(undefined);
    assert.deepEqual(result, []);
});

test('initializeAvailability returns empty array when input is null', () => {
    const result = initializeAvailability(null as any);
    assert.deepEqual(result, []);
});

test('initializeAvailability returns existing array when provided', () => {
    const existing = [{ date: '2024-01-01', times: ['10:00', '11:00'] }];
    const result = initializeAvailability(existing);
    assert.deepEqual(result, existing);
    assert.strictEqual(result, existing); // Should return same reference
});

test('initializeAvailability returns empty array when input is empty array', () => {
    const result = initializeAvailability([]);
    assert.deepEqual(result, []);
});

// ============================================================================
// generateTimeSlots Tests
// ============================================================================

test('generateTimeSlots generates correct slots for single hour', () => {
    const result = generateTimeSlots('10:00', 1);
    assert.deepEqual(result, ['10:00']);
});

test('generateTimeSlots generates correct slots for multiple hours', () => {
    const result = generateTimeSlots('10:00', 3);
    assert.deepEqual(result, ['10:00', '11:00', '12:00']);
});

test('generateTimeSlots handles midnight correctly', () => {
    const result = generateTimeSlots('00:00', 2);
    assert.deepEqual(result, ['00:00', '01:00']);
});

test('generateTimeSlots handles end of day correctly', () => {
    const result = generateTimeSlots('22:00', 2);
    assert.deepEqual(result, ['22:00', '23:00']);
});

test('generateTimeSlots handles zero hours', () => {
    const result = generateTimeSlots('10:00', 0);
    assert.deepEqual(result, []);
});

test('generateTimeSlots handles single digit hours correctly', () => {
    const result = generateTimeSlots('09:00', 2);
    assert.deepEqual(result, ['09:00', '10:00']);
});

test('generateTimeSlots handles full day (24 hours)', () => {
    const result = generateTimeSlots('00:00', 24);
    assert.equal(result.length, 24);
    assert.equal(result[0], '00:00');
    assert.equal(result[23], '23:00');
});

test('generateTimeSlots handles time format with minutes (ignores minutes)', () => {
    const result = generateTimeSlots('10:30', 2);
    // Should parse hour as 10, ignoring minutes
    assert.deepEqual(result, ['10:00', '11:00']);
});

test('generateTimeSlots handles edge case of crossing midnight', () => {
    // Note: This function doesn't handle day boundaries, but we test its behavior
    const result = generateTimeSlots('23:00', 1);
    assert.deepEqual(result, ['23:00']);
});

// ============================================================================
// areAllSlotsAvailable Tests
// ============================================================================

test('areAllSlotsAvailable returns true when all slots are available', () => {
    const timeSlots = ['10:00', '11:00', '12:00'];
    const availableTimes = ['09:00', '10:00', '11:00', '12:00', '13:00'];
    const result = areAllSlotsAvailable(timeSlots, availableTimes);
    assert.strictEqual(result, true);
});

test('areAllSlotsAvailable returns false when one slot is missing', () => {
    const timeSlots = ['10:00', '11:00', '12:00'];
    const availableTimes = ['10:00', '11:00', '13:00'];
    const result = areAllSlotsAvailable(timeSlots, availableTimes);
    assert.strictEqual(result, false);
});

test('areAllSlotsAvailable returns false when multiple slots are missing', () => {
    const timeSlots = ['10:00', '11:00', '12:00'];
    const availableTimes = ['09:00', '13:00'];
    const result = areAllSlotsAvailable(timeSlots, availableTimes);
    assert.strictEqual(result, false);
});

test('areAllSlotsAvailable returns true for empty timeSlots array', () => {
    const timeSlots: string[] = [];
    const availableTimes = ['10:00', '11:00'];
    const result = areAllSlotsAvailable(timeSlots, availableTimes);
    assert.strictEqual(result, true);
});

test('areAllSlotsAvailable returns false when availableTimes is empty', () => {
    const timeSlots = ['10:00', '11:00'];
    const availableTimes: string[] = [];
    const result = areAllSlotsAvailable(timeSlots, availableTimes);
    assert.strictEqual(result, false);
});

test('areAllSlotsAvailable returns true when both arrays are empty', () => {
    const result = areAllSlotsAvailable([], []);
    assert.strictEqual(result, true);
});

test('areAllSlotsAvailable handles single slot correctly', () => {
    const result1 = areAllSlotsAvailable(['10:00'], ['10:00', '11:00']);
    assert.strictEqual(result1, true);
    
    const result2 = areAllSlotsAvailable(['10:00'], ['11:00', '12:00']);
    assert.strictEqual(result2, false);
});

test('areAllSlotsAvailable handles duplicate slots in timeSlots', () => {
    const timeSlots = ['10:00', '10:00', '11:00'];
    const availableTimes = ['10:00', '11:00'];
    const result = areAllSlotsAvailable(timeSlots, availableTimes);
    assert.strictEqual(result, true);
});

// ============================================================================
// removeTimeSlots Tests
// ============================================================================

test('removeTimeSlots removes single slot correctly', () => {
    const availableTimes = ['09:00', '10:00', '11:00', '12:00'];
    const timeSlots = ['10:00'];
    const result = removeTimeSlots(availableTimes, timeSlots);
    assert.deepEqual(result, ['09:00', '11:00', '12:00']);
});

test('removeTimeSlots removes multiple slots correctly', () => {
    const availableTimes = ['09:00', '10:00', '11:00', '12:00', '13:00'];
    const timeSlots = ['10:00', '12:00'];
    const result = removeTimeSlots(availableTimes, timeSlots);
    assert.deepEqual(result, ['09:00', '11:00', '13:00']);
});

test('removeTimeSlots handles removing all slots', () => {
    const availableTimes = ['10:00', '11:00', '12:00'];
    const timeSlots = ['10:00', '11:00', '12:00'];
    const result = removeTimeSlots(availableTimes, timeSlots);
    assert.deepEqual(result, []);
});

test('removeTimeSlots handles removing non-existent slots gracefully', () => {
    const availableTimes = ['10:00', '11:00'];
    const timeSlots = ['12:00', '13:00'];
    const result = removeTimeSlots(availableTimes, timeSlots);
    assert.deepEqual(result, ['10:00', '11:00']);
});

test('removeTimeSlots handles empty timeSlots array', () => {
    const availableTimes = ['10:00', '11:00', '12:00'];
    const timeSlots: string[] = [];
    const result = removeTimeSlots(availableTimes, timeSlots);
    assert.deepEqual(result, availableTimes);
});

test('removeTimeSlots handles empty availableTimes array', () => {
    const availableTimes: string[] = [];
    const timeSlots = ['10:00', '11:00'];
    const result = removeTimeSlots(availableTimes, timeSlots);
    assert.deepEqual(result, []);
});

test('removeTimeSlots handles duplicate slots in timeSlots', () => {
    const availableTimes = ['10:00', '11:00', '12:00'];
    const timeSlots = ['10:00', '10:00', '11:00'];
    const result = removeTimeSlots(availableTimes, timeSlots);
    assert.deepEqual(result, ['12:00']);
});

test('removeTimeSlots preserves order of remaining slots', () => {
    const availableTimes = ['09:00', '10:00', '11:00', '12:00', '13:00'];
    const timeSlots = ['11:00'];
    const result = removeTimeSlots(availableTimes, timeSlots);
    assert.deepEqual(result, ['09:00', '10:00', '12:00', '13:00']);
});

// ============================================================================
// addTimeSlots Tests
// ============================================================================

test('addTimeSlots adds single slot correctly', () => {
    const currentTimes = ['10:00', '11:00', '13:00'];
    const timeSlotsToAdd = ['12:00'];
    const result = addTimeSlots(currentTimes, timeSlotsToAdd);
    assert.deepEqual(result, ['10:00', '11:00', '12:00', '13:00']);
});

test('addTimeSlots adds multiple slots correctly', () => {
    const currentTimes = ['10:00', '13:00'];
    const timeSlotsToAdd = ['11:00', '12:00'];
    const result = addTimeSlots(currentTimes, timeSlotsToAdd);
    assert.deepEqual(result, ['10:00', '11:00', '12:00', '13:00']);
});

test('addTimeSlots handles empty currentTimes array', () => {
    const currentTimes: string[] = [];
    const timeSlotsToAdd = ['10:00', '11:00'];
    const result = addTimeSlots(currentTimes, timeSlotsToAdd);
    assert.deepEqual(result, ['10:00', '11:00']);
});

test('addTimeSlots handles empty timeSlotsToAdd array', () => {
    const currentTimes = ['10:00', '11:00'];
    const timeSlotsToAdd: string[] = [];
    const result = addTimeSlots(currentTimes, timeSlotsToAdd);
    assert.deepEqual(result, ['10:00', '11:00']);
});

test('addTimeSlots removes duplicates correctly', () => {
    const currentTimes = ['10:00', '11:00'];
    const timeSlotsToAdd = ['11:00', '12:00'];
    const result = addTimeSlots(currentTimes, timeSlotsToAdd);
    assert.deepEqual(result, ['10:00', '11:00', '12:00']);
});

test('addTimeSlots handles duplicates within timeSlotsToAdd', () => {
    const currentTimes = ['10:00'];
    const timeSlotsToAdd = ['11:00', '11:00', '12:00'];
    const result = addTimeSlots(currentTimes, timeSlotsToAdd);
    assert.deepEqual(result, ['10:00', '11:00', '12:00']);
});

test('addTimeSlots sorts results correctly', () => {
    const currentTimes = ['13:00', '10:00', '12:00'];
    const timeSlotsToAdd = ['11:00', '09:00'];
    const result = addTimeSlots(currentTimes, timeSlotsToAdd);
    assert.deepEqual(result, ['09:00', '10:00', '11:00', '12:00', '13:00']);
});

test('addTimeSlots handles unsorted input and produces sorted output', () => {
    const currentTimes = ['15:00', '08:00', '20:00'];
    const timeSlotsToAdd = ['12:00', '05:00'];
    const result = addTimeSlots(currentTimes, timeSlotsToAdd);
    assert.deepEqual(result, ['05:00', '08:00', '12:00', '15:00', '20:00']);
});

test('addTimeSlots handles midnight correctly', () => {
    const currentTimes = ['23:00'];
    const timeSlotsToAdd = ['00:00'];
    const result = addTimeSlots(currentTimes, timeSlotsToAdd);
    assert.deepEqual(result, ['00:00', '23:00']);
});

test('addTimeSlots handles all slots already existing', () => {
    const currentTimes = ['10:00', '11:00', '12:00'];
    const timeSlotsToAdd = ['10:00', '11:00', '12:00'];
    const result = addTimeSlots(currentTimes, timeSlotsToAdd);
    assert.deepEqual(result, ['10:00', '11:00', '12:00']);
});

// ============================================================================
// findOrCreateDateAvailability Tests
// ============================================================================

test('findOrCreateDateAvailability finds existing date availability', () => {
    const availability = [
        { date: '2024-01-01', times: ['10:00', '11:00'] },
        { date: '2024-01-02', times: ['12:00', '13:00'] }
    ];
    const result = findOrCreateDateAvailability(availability, '2024-01-01', defaultHours);
    assert.deepEqual(result, { date: '2024-01-01', times: ['10:00', '11:00'] });
    assert.strictEqual(result, availability[0]); // Should return same reference
});

test('findOrCreateDateAvailability creates new date availability when not found', () => {
    const availability: any[] = [
        { date: '2024-01-01', times: ['10:00', '11:00'] }
    ];
    const result = findOrCreateDateAvailability(availability, '2024-01-02', defaultHours);
    assert.deepEqual(result, { date: '2024-01-02', times: defaultHours });
    assert.equal(availability.length, 2);
    assert.deepEqual(availability[1], result);
});

test('findOrCreateDateAvailability creates new date in empty availability array', () => {
    const availability: any[] = [];
    const result = findOrCreateDateAvailability(availability, '2024-01-01', defaultHours);
    assert.deepEqual(result, { date: '2024-01-01', times: defaultHours });
    assert.equal(availability.length, 1);
    assert.deepEqual(availability[0], result);
});

test('findOrCreateDateAvailability does not duplicate when date already exists', () => {
    const availability: any[] = [
        { date: '2024-01-01', times: ['10:00', '11:00'] }
    ];
    const initialLength = availability.length;
    const result = findOrCreateDateAvailability(availability, '2024-01-01', defaultHours);
    assert.equal(availability.length, initialLength);
    assert.strictEqual(result, availability[0]);
});

test('findOrCreateDateAvailability creates with custom default hours', () => {
    const customHours = ['09:00', '10:00', '11:00'];
    const availability: any[] = [];
    const result = findOrCreateDateAvailability(availability, '2024-01-01', customHours);
    assert.deepEqual(result.times, customHours);
});

test('findOrCreateDateAvailability handles multiple dates correctly', () => {
    const availability: any[] = [];
    const date1 = findOrCreateDateAvailability(availability, '2024-01-01', defaultHours);
    const date2 = findOrCreateDateAvailability(availability, '2024-01-02', defaultHours);
    const date1Again = findOrCreateDateAvailability(availability, '2024-01-01', defaultHours);
    
    assert.equal(availability.length, 2);
    assert.strictEqual(date1, date1Again); // Should return same reference
    assert.notStrictEqual(date1, date2); // Different dates should be different objects
});

// ============================================================================
// Integration-style Tests (Testing functions work together)
// ============================================================================

test('Complete booking flow: generate -> check -> remove -> add back', () => {
    // Generate time slots for a 3-hour booking
    const requestedSlots = generateTimeSlots('10:00', 3);
    assert.deepEqual(requestedSlots, ['10:00', '11:00', '12:00']);
    
    // Check if all slots are available
    const availableTimes = defaultHours;
    const allAvailable = areAllSlotsAvailable(requestedSlots, availableTimes);
    assert.strictEqual(allAvailable, true);
    
    // Remove slots from availability
    const afterBooking = removeTimeSlots(availableTimes, requestedSlots);
    assert.equal(afterBooking.length, 21); // 24 - 3 = 21
    assert.ok(!afterBooking.includes('10:00'));
    assert.ok(!afterBooking.includes('11:00'));
    assert.ok(!afterBooking.includes('12:00'));
    
    // Add slots back (cancellation scenario)
    const afterCancellation = addTimeSlots(afterBooking, requestedSlots);
    assert.equal(afterCancellation.length, 24);
    assert.ok(afterCancellation.includes('10:00'));
    assert.ok(afterCancellation.includes('11:00'));
    assert.ok(afterCancellation.includes('12:00'));
});

test('Partial booking scenario: some slots unavailable', () => {
    const requestedSlots = generateTimeSlots('10:00', 3);
    const availableTimes = ['09:00', '10:00', '12:00', '13:00']; // 11:00 missing
    
    const allAvailable = areAllSlotsAvailable(requestedSlots, availableTimes);
    assert.strictEqual(allAvailable, false); // Should fail because 11:00 is missing
});

test('Availability initialization and date management flow', () => {
    // Start with undefined availability
    let availability = initializeAvailability(undefined);
    assert.deepEqual(availability, []);
    
    // Create availability for a date
    const dateAvailability = findOrCreateDateAvailability(availability, '2024-01-01', defaultHours);
    assert.equal(availability.length, 1);
    assert.deepEqual(dateAvailability.times, defaultHours);
    
    // Book some slots
    const bookedSlots = generateTimeSlots('10:00', 2);
    dateAvailability.times = removeTimeSlots(dateAvailability.times, bookedSlots);
    assert.equal(dateAvailability.times.length, 22); // 24 - 2
    
    // Retrieve same date availability again
    const sameDate = findOrCreateDateAvailability(availability, '2024-01-01', defaultHours);
    assert.strictEqual(sameDate, dateAvailability); // Same reference
    assert.equal(sameDate.times.length, 22); // Should preserve changes
});

