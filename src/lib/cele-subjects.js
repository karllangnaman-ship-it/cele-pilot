export const CELE_SUBJECTS = {
  MSTE: {
    Mathematics: ['Algebra', 'Trigonometry', 'Analytic Geometry', 'Plane Geometry', 'Solid Geometry', 'Differential Calculus', 'Integral Calculus', 'Differential Equations', 'Engineering Economy', 'Probability', 'Statistics', 'Numerical Methods'],
    Surveying: ['Plane Surveying', 'Geodetic Surveying', 'Route Surveying', 'Construction Surveying', 'Hydrographic Surveying', 'GPS/GNSS Surveying', 'Photogrammetry', 'Mapping', 'Survey Computations'],
    'Transportation Engineering': ['Highway Engineering', 'Traffic Engineering', 'Airport Engineering', 'Railway Engineering', 'Port and Harbor Engineering', 'Pavement Design', 'Transportation Planning'],
  },
  HGE: {
    Hydraulics: ['Fluid Mechanics', 'Pipe Flow', 'Open Channel Flow', 'Hydrology', 'Water Resources Engineering', 'Pumps', 'Hydraulic Machines', 'Irrigation Engineering', 'Drainage Engineering'],
    'Geotechnical Engineering': ['Soil Mechanics', 'Foundation Engineering', 'Earth Pressure', 'Slope Stability', 'Bearing Capacity', 'Consolidation', 'Compaction', 'Soil Exploration', 'Retaining Structures'],
  },
  PSAD: {
    'Professional Education': [
      'Principles of Teaching',
      'Facilitating Learning',
      'Curriculum Development',
      'Assessment of Learning',
      'Educational Technology',
      'Teaching Strategies',
      'Classroom Management',
      'Educational Psychology',
      'Child and Adolescent Development',
      'Human Growth and Development',
      'Guidance and Counseling',
      'Measurement and Evaluation',
      'Research Methods',
      'Professional Ethics',
      'Special and Inclusive Education',
      'Communication Skills',
      'Educational Leadership',
      'Laws and Policies in Education',
      'Values Education',
      'Field Study and Practice Teaching',
    ],
  },
};

export const SUBJECT_COLORS = {
  MSTE: 'bg-blue-500',
  HGE: 'bg-green-500',
  PSAD: 'bg-purple-500',
};

export const COLOR_OPTIONS = [
  { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { value: 'green', label: 'Green', class: 'bg-green-500' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-500' },
  { value: 'red', label: 'Red', class: 'bg-red-500' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-500' },
  { value: 'cyan', label: 'Cyan', class: 'bg-cyan-500' },
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-500' },
];

export const COLOR_CLASSES = {
  blue: 'bg-blue-500', green: 'bg-green-500', purple: 'bg-purple-500',
  orange: 'bg-orange-500', red: 'bg-red-500', pink: 'bg-pink-500',
  cyan: 'bg-cyan-500', yellow: 'bg-yellow-500',
};

export const PRIORITY_COLORS = {
  low: 'bg-green-500',
  medium: 'bg-yellow-500',
  high: 'bg-red-500',
};

export const SUBJECT_LIST = ['MSTE', 'HGE', 'PSAD'];

export function getAllTopicsForSubject(subject) {
  const cats = CELE_SUBJECTS[subject];
  if (!cats) return [];
  return Object.values(cats).flat();
}