import { useState } from "react"
/**
 *
 * @param {
 * items: Object []
 * styles: Object
 * } param0
 * @returns
 *
 * item: {
 *      name: String,
 *      payload: Object
 * }
 *
 * styles: {
 *      button: String (className),
 *      display: String (className),
 * }
 */

const Filter = ({ items, styles, onChange }) => {
  const [selected, setSelected] = useState([])
  const [error, setError] = useState(null)

  const handleSelect = (item) => {
    let memo
    if (selected.map((s) => s.name).includes(item.name)) {
      memo = selected.filter((s) => s.name !== item.name)
    } else {
      memo = [...new Set([...selected, item])]
    }
    setSelected(memo)
    onChange && onChange(memo)
  }

  return (
    <div>
      {items &&
        items.length &&
        items.map((item) => (
          <button
            className={
              selected.map((s) => s.name).includes(item.name)
                ? styles.button + " " + styles.selected
                : styles.button
            }
            onClick={() => handleSelect(item)}
          >
            {item.name}
          </button>
        ))}
    </div>
  )
}

export default Filter
