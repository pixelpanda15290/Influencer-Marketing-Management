import { Employee, IEmployee, IUser } from '../models/allModels';

/**
 * Robustly finds the Employee document corresponding to an authenticated User document.
 * Matches strictly by userId or exact user email address to prevent cross-account mismatches.
 */
export async function getEmployeeForAuthUser(user?: IUser | null): Promise<IEmployee | null> {
  if (!user) return null;

  // 1. Primary lookup: Match exact userId
  if (user._id) {
    const empByUserId = await Employee.findOne({ userId: user._id }).populate('department', 'name code description status');
    if (empByUserId) return empByUserId;
  }

  // 2. Secondary lookup: Match user email address (case-insensitive)
  if (user.email) {
    const trimmedEmail = user.email.trim();
    const empByEmail = await Employee.findOne({
      email: { $regex: new RegExp(`^${trimmedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    }).populate('department', 'name code description status');
    if (empByEmail) return empByEmail;
  }

  // 3. Match by employeeId if present
  if ((user as any).employeeId) {
    const empById = await Employee.findOne({ employeeId: (user as any).employeeId }).populate('department', 'name code description status');
    if (empById) return empById;
  }

  // 4. Fallback: Match by exact name (case-insensitive)
  if (user.name) {
    const trimmedName = user.name.trim();
    const empByName = await Employee.findOne({
      name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    }).populate('department', 'name code description status');
    if (empByName) return empByName;
  }

  return null;
}

