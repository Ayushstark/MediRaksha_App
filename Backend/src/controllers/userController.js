import { pool } from '../config/db.js';

/**
 * @route   GET /api/user/info/detail
 * @desc    Get current user profile details
 */
export const getUserDetails = async (req, res) => {
  try {
    const userId = req.user.id; // Extracted from authVerify middleware

    // Explicitly select fields to avoid sending the password hash back to the client
    const query = `
      SELECT "id", "name", "email", "number", "age", "gender", "registeredDoctorId", "created_at", "updated_at" 
      FROM "User" 
      WHERE "id" = $1;
    `;
    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving user data.' });
  }
};

/**
 * @route   PATCH /api/user/info/update
 * @desc    Update specific fields of user profile dynamically
 */
export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, number, age, gender, registeredDoctorId } = req.body;

    // 1. Dynamically build the SQL update query based on provided fields
    const fieldsToUpdate = [];
    const values = [];
    let queryIndex = 1;

    if (name !== undefined) {
      fieldsToUpdate.push(`"name" = $${queryIndex++}`);
      values.push(name);
    }
    if (number !== undefined) {
      fieldsToUpdate.push(`"number" = $${queryIndex++}`);
      values.push(number);
    }
    if (age !== undefined) {
      fieldsToUpdate.push(`"age" = $${queryIndex++}`);
      values.push(age);
    }
    if (gender !== undefined) {
      fieldsToUpdate.push(`"gender" = $${queryIndex++}`);
      values.push(gender);
    }
    if (registeredDoctorId !== undefined) {
      fieldsToUpdate.push(`"registeredDoctorId" = $${queryIndex++}`);
      values.push(registeredDoctorId || null); // handle fallback to null if blanked out
    }

    // If no values were provided to update
    if (fieldsToUpdate.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields provided for update.' });
    }

    // Always append updated_at field update
    fieldsToUpdate.push(`"updated_at" = NOW()`);

    // Append userId at the end of values array for the WHERE clause
    values.push(userId);
    const whereClauseIndex = queryIndex;

    const query = `
      UPDATE "User"
      SET ${fieldsToUpdate.join(', ')}
      WHERE "id" = $${whereClauseIndex}
      RETURNING "id", "name", "email", "number", "age", "gender", "registeredDoctorId", "updated_at";
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User profile update failed.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating user profile:', error);
    return res.status(500).json({ success: false, message: 'Server error updating profile.' });
  }
};

/**
 * @route   DELETE /api/user/info/delete
 * @desc    Delete the logged in user account and clear client cookie
 */
export const deleteUserAccount = async (req, res) => {
  try {
    const userId = req.user.id;

    // Note: Due to foreign key constraints, you might want to handle cascading deletes 
    // for user reports first if your DB doesn't have 'ON DELETE CASCADE' set up.
    
    // First delete user's reports metadata
    await pool.query(`DELETE FROM "Report" WHERE "userId" = $1;`, [userId]);

    // Then delete the user account
    const query = `DELETE FROM "User" WHERE id = $1 RETURNING "id";`;
    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    // Optional: Clear auth token cookie upon account deletion if using cookies
    res.clearCookie('token'); 

    return res.status(200).json({
      success: true,
      message: 'User account and associated data deleted successfully.'
    });

  } catch (error) {
    console.error('Error deleting user account:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting account.' });
  }
};