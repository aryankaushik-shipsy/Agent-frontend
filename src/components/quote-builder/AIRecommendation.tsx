interface Props {
  text: string | undefined
}

export function AIRecommendation({ text }: Props) {
  if (!text) return null
  return (
    <div className="rec-box">
      <div className="rec-box-label">AI Recommendation</div>
      <p>{text}</p>
    </div>
  )
}
