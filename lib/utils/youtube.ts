// YouTube URL 에서 영상 ID 추출. 다음 패턴 모두 지원:
//   - https://youtu.be/<id>
//   - https://www.youtube.com/watch?v=<id>
//   - https://youtube.com/embed/<id>
//   - https://www.youtube.com/shorts/<id>
// 일치 시 11자 영상 ID 반환, 미일치 시 null.
//
// 어드민 에디터(미리보기) 와 사용자 샘플 페이지 렌더러에서 같은 함수를 공유합니다.
export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}
