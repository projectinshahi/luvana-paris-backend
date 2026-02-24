const express = require('express');
const router = express.Router();
const addressController = require('../../controller/user/addressController');
const authMiddleware = require('../../middleware/authMiddleware');

router.use(authMiddleware);

// POST /users/address - Create new address
router.post('/', addressController.createAddress);

// GET /users/address - Get all addresses
router.get('/', addressController.getAddresses);

// GET /users/address/:addressId - Get address by id
router.get('/:addressId', addressController.getAddressById);

// PUT /users/address/:addressId - Update address
router.put('/:addressId', addressController.updateAddress);

// DELETE /users/address/:addressId - Delete address
router.delete('/:addressId', addressController.deleteAddress);

module.exports = router;
