const Admin = require('../../model/adminModel');

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const admin = await Admin.findOne({ email });//.populate('role');
        if (!admin) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        if (admin.status !== 'active') {
            return res.status(403).json({ message: 'Account is inactive' });
        }

        const isPasswordValid = await admin.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Update last login
        admin.lastlogin = new Date();
        await admin.save();

        // Generate token
        const token = admin.generateAccessToken();

        res.json({
            message: 'Login successful',
            token,
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                // role: admin.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    login
};