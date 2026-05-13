import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem('refresh_token');
        const { data } = await axios.post(
          `${api.defaults.baseURL}/auth/token/refresh/`,
          { refresh }
        );
        localStorage.setItem('access_token', data.access);
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

export const authAPI = {
  register: (data) => api.post('/auth/register/', data),
  login: (data) => api.post('/auth/login/', data),
  me: () => api.get('/auth/me/'),
  updateMe: (data) => api.patch('/auth/me/', data),
  users: () => api.get('/auth/users/'),
  updateUser: (id, data) => api.patch(`/auth/users/${id}/`, data),
  platformStats: () => api.get('/auth/stats/'),
};

export const adminAPI = {
  // Modules
  createModule: (courseSlug, data) => api.post(`/courses/${courseSlug}/modules/`, data),
  updateModule: (id, data) => api.patch(`/courses/modules/${id}/`, data),
  deleteModule: (id) => api.delete(`/courses/modules/${id}/`),
  // Lessons
  createLesson: (moduleId, data) => api.post(`/courses/modules/${moduleId}/lessons/`, data),
  updateLesson: (id, data) => api.patch(`/courses/lessons/${id}/`, data),
  deleteLesson: (id) => api.delete(`/courses/lessons/${id}/`),
  // Content blocks
  createBlock: (lessonId, data) => api.post(`/content/lessons/${lessonId}/blocks/`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateBlock: (id, data) => api.patch(`/content/blocks/${id}/`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteBlock: (id) => api.delete(`/content/blocks/${id}/`),
  // Drip rules
  setDripRule: (data) => api.post('/drip/rules/', data),
  updateDripRule: (lessonId, data) => api.patch(`/drip/rules/${lessonId}/`, data),
  manualUnlock: (lessonId, data) => api.post(`/drip/unlock/${lessonId}/`, data),
  // AI Questions (admin)
  getAIQuestions: (lessonId) => api.get(`/assessments/lessons/${lessonId}/questions/`),
  createAIQuestion: (lessonId, data) => api.post(`/assessments/lessons/${lessonId}/questions/`, data),
  deleteAIQuestion: (id) => api.delete(`/assessments/questions/${id}/`),
  // Moodle Quizzes (admin)
  getMoodleQuizzes: (lessonId) => api.get(`/assessments/lessons/${lessonId}/quizzes/`),
  createMoodleQuiz: (lessonId, data) => api.post(`/assessments/lessons/${lessonId}/quizzes/`, data),
  deleteMoodleQuiz: (id) => api.delete(`/assessments/quizzes/${id}/`),
};

export const coursesAPI = {
  list: (params) => api.get('/courses/', { params }),
  detail: (slug) => api.get(`/courses/${slug}/`),
  create: (data) => api.post('/courses/', data),
  update: (slug, data) => api.patch(`/courses/${slug}/`, data),
  modules: (slug) => api.get(`/courses/${slug}/modules/`),
  enroll: (slug) => api.post(`/courses/${slug}/enroll/`),
  myEnrollments: () => api.get('/courses/my-enrollments/'),
};

export const lessonsAPI = {
  detail: (id) => api.get(`/content/lessons/${id}/`),
  blocks: (id) => api.get(`/content/lessons/${id}/blocks/`),
  complete: (id) => api.post(`/content/lessons/${id}/complete/`),
  dripStatus: (id) => api.get(`/content/lessons/${id}/drip-status/`),
};

export const aiAPI = {
  getQuestions: (lessonId) => api.get(`/assessments/lessons/${lessonId}/questions/`),
  submit: (questionId, data) => api.post(`/assessments/questions/${questionId}/submit/`, data),
  getSubmissions: (lessonId) => api.get(`/assessments/lessons/${lessonId}/submissions/`),
  override: (id, data) => api.patch(`/assessments/submissions/${id}/override/`, data),
  getMoodleQuizzes: (lessonId) => api.get(`/assessments/lessons/${lessonId}/quizzes/`),
  startQuiz: (quizId) => api.post(`/assessments/quizzes/${quizId}/start/`),
};

export const quizAPI = {
  info: (id) => api.get(`/assessments/quizzes/${id}/`),
  start: (id) => api.post(`/assessments/quizzes/${id}/start/`),
  getAttempt: (id, attemptId) => api.get(`/assessments/quizzes/${id}/attempts/${attemptId}/`),
  submit: (id, attemptId, data) => api.post(`/assessments/quizzes/${id}/attempts/${attemptId}/submit/`, data),
  review: (id, attemptId) => api.get(`/assessments/quizzes/${id}/attempts/${attemptId}/review/`),
};

export const paymentsAPI = {
  createOrder: (data) => api.post('/payments/orders/', data),
  submitReference: (id, data) => api.post(`/payments/orders/${id}/reference/`, data),
  getOrder: (id) => api.get(`/payments/orders/${id}/`),
  pendingOrders: () => api.get('/payments/orders/pending/'),
  myOrders: () => api.get('/payments/orders/my/'),
  verifyOrder: (id, data) => api.patch(`/payments/orders/${id}/verify/`, data),
};

export const progressAPI = {
  courseProgress: (enrollmentId) => api.get(`/progress/enrollment/${enrollmentId}/`),
  studentAnalytics: (userId) => api.get(`/progress/student/${userId}/`),
  courseAnalytics: (slug) => api.get(`/progress/course/${slug}/`),
};

export const certificatesAPI = {
  list: () => api.get('/certificates/'),
  download: (id) => api.get(`/certificates/${id}/download/`, { responseType: 'blob' }),
  verify: (uuid) => api.get(`/certificates/verify/${uuid}/`),
};
