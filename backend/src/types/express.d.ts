import type { User } from '../models/User.js';

declare global {
  namespace Express {
    interface Locals {
      authenticatedUser?: User;
    }
  }
}

export {};
