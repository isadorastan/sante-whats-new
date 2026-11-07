import logo from '../assets/sante-logo.png'
import hero from '../assets/hero-gym.png'
import { alunoHref } from '../utils/paths'

export function GymHome() {
  return (
    <div className="home">
      <header
        className="home-hero"
        style={{ backgroundImage: `url(${hero})` }}
      >
        <div className="home-hero__top">
          <img
            className="home-hero__logo"
            src={logo}
            alt="Santé Centro de Treinamento Físico"
          />
          <a className="btn btn--primary" href={alunoHref()}>
            Login
          </a>
        </div>
      </header>
    </div>
  )
}
