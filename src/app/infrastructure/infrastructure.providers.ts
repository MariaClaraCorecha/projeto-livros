import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { environment } from '../../environments/environment';
import {
  AnnotationRepository,
  AuthGateway,
  BookRepository,
  PreferencesRepository,
  ShelfRepository,
  StickerRepository,
} from '../domain/repositories';
import { BookMetadataExtractor, FontCatalog, FontLoader, ReaderEngineFactory } from '../application/ports';
import { FirebaseAuthGateway } from './auth/firebase-auth.gateway';
import { GuestAuthGateway } from './auth/guest-auth.gateway';
import { GoogleFontCatalog, GoogleFontLoader } from './fonts/google-fonts';
import { DefaultBookMetadataExtractor } from './parsers/book-metadata.extractor';
import {
  IdbAnnotationRepository,
  IdbBookRepository,
  IdbPreferencesRepository,
  IdbShelfRepository,
  IdbStickerRepository,
} from './persistence/idb.repositories';
import { LazyReaderEngineFactory } from './readers/reader-engine.factory';

/** Liga as portas do domínio/aplicação às implementações concretas. */
export function provideInfrastructure(): EnvironmentProviders {
  const firebaseConfigured = !!environment.firebase.apiKey;
  return makeEnvironmentProviders([
    { provide: AuthGateway, useClass: firebaseConfigured ? FirebaseAuthGateway : GuestAuthGateway },
    { provide: BookRepository, useClass: IdbBookRepository },
    { provide: ShelfRepository, useClass: IdbShelfRepository },
    { provide: AnnotationRepository, useClass: IdbAnnotationRepository },
    { provide: PreferencesRepository, useClass: IdbPreferencesRepository },
    { provide: StickerRepository, useClass: IdbStickerRepository },
    { provide: BookMetadataExtractor, useClass: DefaultBookMetadataExtractor },
    { provide: FontLoader, useClass: GoogleFontLoader },
    { provide: FontCatalog, useClass: GoogleFontCatalog },
    { provide: ReaderEngineFactory, useClass: LazyReaderEngineFactory },
  ]);
}
