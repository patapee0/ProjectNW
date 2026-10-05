/**
 * KKU Authentication & Social Link Routes
 * Domain Verification for @kkumail.com + Social Enrichment Mock
 */
const express = require('express');
const router = express.Router();

// Mock KKU Student Auth Database
const kkuAccounts = {
  'patapee.s@kkumail.com': { studentId: '653040001-2', name: 'ปฐพี สุขเจริญ', faculty: 'วิศวกรรมศาสตร์', status: 'VERIFIED' },
  'somchai.k@kkumail.com': { studentId: '653040002-0', name: 'สมชาย ขอนแก่น', faculty: 'วิทยาศาสตร์', status: 'VERIFIED' },
  'ploy.p@kkumail.com': { studentId: '653040003-8', name: 'พลอย พรไพลิน', faculty: 'มนุษยศาสตร์', status: 'VERIFIED' }
};

/**
 * POST /api/auth/kku-login
 * Body: { email, password }
 */
router.post('/kku-login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !email.endsWith('@kkumail.com')) {
    return res.status(400).json({
      success: false,
      message: 'โปรดใช้อีเมลมหาวิทยาลัยขอนแก่น (@kkumail.com) เท่านั้น'
    });
  }

  // Check mock DB or auto-generate verification for student
  let account = kkuAccounts[email.toLowerCase()];
  if (!account) {
    const studentIdMatch = email.match(/^([a-zA-Z0-9.]+)/);
    const prefix = studentIdMatch ? studentIdMatch[1] : 'student';
    account = {
      studentId: `6530${Math.floor(10000 + Math.random() * 90000)}-${Math.floor(Math.random() * 9)}`,
      name: prefix.toUpperCase(),
      faculty: 'วิทยาลัยการคอมพิวเตอร์ (CP KKU)',
      status: 'VERIFIED'
    };
  }

  const token = `kku_auth_token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  res.json({
    success: true,
    message: 'ยืนยันตัวตน KKU Account สำเร็จ!',
    token,
    user: {
      email,
      studentId: account.studentId,
      name: account.name,
      faculty: account.faculty,
      isKkuVerified: true,
      verifiedAt: new Date().toISOString()
    }
  });
});

/**
 * POST /api/auth/social-link
 * Body: { platform: 'facebook'|'instagram', handle: string, profileId: string }
 */
router.post('/social-link', (req, res) => {
  const { platform, handle, profileId } = req.body;

  if (!platform || !handle) {
    return res.status(400).json({ success: false, message: 'กรุณาระบุข้อมูล Social Media' });
  }

  // Mock profile enrichment fetch
  const mockInterests = platform === 'facebook' 
    ? ['#KKUActivity', '#ComplexKKU', '#KasetKKU'] 
    : ['#CafeKhonKaen', '#Photography', '#SithanLake'];

  res.json({
    success: true,
    message: `เชื่อมต่อ ${platform.toUpperCase()} (${handle}) สำเร็จ`,
    socialData: {
      platform,
      handle,
      isLinked: true,
      enrichedInterests: mockInterests,
      linkedAt: new Date().toISOString()
    }
  });
});

module.exports = router;
