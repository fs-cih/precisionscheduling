let lessonCache = null;

export async function getLessons() {
  if (lessonCache) {
    return lessonCache;
  }

  const response = await fetch('lessons.json');
  if (!response.ok) {
    throw new Error('Could not load lessons.json');
  }

  const data = await response.json();
  lessonCache = Array.isArray(data) ? data : [];
  return lessonCache;
}
