// Static config for each branch / service. Folder IDs come from env vars
// (set in Vercel) so the actual IDs are never committed to Git.

const BRANCHES = {
  cubao: {
    key: 'cubao',
    name: 'Cubao',
    folderIdEnv: 'GDRIVE_FOLDER_CUBAO',
    address: 'Level 4, Farmers Plaza Cubao, Quezon City',
    contact: '0945-506-0002',
    isHomeService: false,
  },
  greenhills: {
    key: 'greenhills',
    name: 'Greenhills',
    folderIdEnv: 'GDRIVE_FOLDER_GREENHILLS',
    address: 'Level 3, Vmall Greenhills, San Juan City',
    contact: '0915-212-7000',
    isHomeService: false,
  },
  malolos: {
    key: 'malolos',
    name: 'Malolos',
    folderIdEnv: 'GDRIVE_FOLDER_MALOLOS',
    address: 'Puregold Jr. Crossing, Malolos, Bulacan',
    contact: '0967-310-0077',
    isHomeService: false,
  },
  homeservice: {
    key: 'homeservice',
    name: 'Home Service',
    folderIdEnv: 'GDRIVE_FOLDER_HOMESERVICE',
    address: null,
    contact: null,
    isHomeService: true,
  },
};

// Max photos to include in a single Facebook album post / caption call.
// Facebook allows many, but keep it sane for API + vision limits.
const MAX_PHOTOS_PER_POST = 10;

// Timezone used to group photos by "day" and to decide when a day is closed.
const TIMEZONE = 'Asia/Manila';

module.exports = { BRANCHES, MAX_PHOTOS_PER_POST, TIMEZONE };
