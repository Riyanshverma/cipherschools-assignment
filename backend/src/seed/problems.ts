import { Problem } from '../domain/Problem.js';

/**
 * 5 LLD practice problems. Each `rubricWeights` map only lists dimensions that deviate from
 * the default weight of 1 (see `Rubric.getWeight`) — the pair chosen reflects what actually
 * matters most for that problem's design (decision 8).
 */
export const SEED_PROBLEMS: Problem[] = [
  new Problem(
    'parking-lot',
    'Parking Lot System',
    'Design a parking lot that supports multiple vehicle types (motorcycle, car, bus) and ' +
      'multiple spot sizes, assigning each vehicle to the smallest suitable free spot. The ' +
      'system must track spot availability in real time, compute a parking fee based on ' +
      'duration and vehicle type at exit, and support multiple entry/exit gates operating ' +
      'concurrently. It should also handle the lot being full and reject entry gracefully.',
    'Single facility, no multi-level pricing federation across locations, and no external ' +
      'payment gateway integration required.',
    { extensibility: 2, abstractionPatterns: 2 },
  ),
  new Problem(
    'elevator-system',
    'Elevator System',
    "Design the control system for a bank of elevators in a building, handling both up/down " +
      'hall calls and in-cabin floor requests. The system must decide which elevator to ' +
      'dispatch for a new request using a scheduling policy (e.g. nearest-car or SCAN), track ' +
      "each elevator's direction and current floor, and avoid starving requests that are " +
      'further away. It should support multiple elevators operating independently and door ' +
      'open/close/obstruction handling at each stop.',
    'Single building with a fixed number of elevators configured at startup; no cross-building ' +
      'dispatch and no dynamic elevator addition/removal at runtime.',
    { edgeCasesTestability: 2, extensibility: 2 },
  ),
  new Problem(
    'vending-machine',
    'Vending Machine',
    'Design a vending machine that accepts coins/notes, lets a user select a product, ' +
      'dispenses the product and correct change, and restocks inventory per slot. The machine ' +
      'moves through distinct states — idle, selecting, awaiting payment, dispensing — and ' +
      'must handle insufficient payment, out-of-stock items, and a cancel request that refunds ' +
      'any inserted money. It should also support an operator restocking or adjusting prices ' +
      'without disrupting an in-progress transaction.',
    'Single machine, cash/coin-equivalent payment only, no card/mobile payment integration and ' +
      'no networked fleet management.',
    { classResponsibilities: 2, abstractionPatterns: 2 },
  ),
  new Problem(
    'movie-ticket-booking',
    'Movie Ticket Booking System',
    'Design a system for browsing movies and showtimes at a cinema, selecting seats for a ' +
      "specific show, and completing a booking. Seat selection must place a short-lived hold " +
      "on chosen seats so two users can't double-book the same seat, and the hold must expire " +
      "and release the seats if payment isn't completed in time. The system should support " +
      'multiple showtimes per movie, multiple seat categories with different pricing, and ' +
      'cancellation with a seat becoming available again.',
    'Single cinema, no dynamic pricing/surge logic, and no external payment gateway integration ' +
      'required.',
    { edgeCasesTestability: 2, requirementUnderstanding: 2 },
  ),
  new Problem(
    'rate-limiter',
    'Rate Limiter',
    'Design a rate limiter that can be attached in front of an API to cap the number of ' +
      'requests a client can make within a rolling time window, rejecting requests over the ' +
      'limit. It should support pluggable limiting algorithms (e.g. token bucket, sliding ' +
      'window) chosen per client or per endpoint, and behave correctly under concurrent ' +
      'requests from the same client. It must also expose enough state (remaining quota, reset ' +
      'time) for the caller to communicate limits back to the client.',
    'Single-process, in-memory limiter; no distributed/shared-state coordination across ' +
      'multiple service instances required.',
    { edgeCasesTestability: 2, encapsulationInterfaces: 2 },
  ),
];
